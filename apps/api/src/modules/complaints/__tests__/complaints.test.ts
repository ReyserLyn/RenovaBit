/**
 * Complaints (Libro de Reclamaciones) integration tests.
 *
 * Covers the legally required contract (Ley 29571, DS 011-2011-PCM):
 *   - public registration returns 201 with an `RB-XXXXXXXX` code
 *   - TypeBox validation rejects malformed payloads (letters in the phone)
 *   - a claim filed for a minor requires the guardian's name and document
 *   - the admin surface (list/search/detail/respond) behaves as contract
 *   - the pending-per-document cap protects the book from flooding
 *   - anonymous requests are rejected by the admin guard
 *
 * Prerequisites:
 *   - Dev Postgres running (`docker compose -f docker-compose.dev.yaml up -d`)
 *   - `DATABASE_URL` pointing to the dev DB (loaded from packages/db/.env)
 */
import { afterAll, describe, expect, it } from "bun:test";
import { db } from "@renovabit/db";
import { adminNotifications, complaints, users } from "@renovabit/db/schema";
import { inArray, or, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { modules } from "@/modules";
import { errorHandler } from "@/plugins/error-handler";
import { LoggerPlugin } from "@/plugins/logger";
import type { ComplaintModel } from "../model";
import { ComplaintService } from "../service";

// ── DB probe (same pattern as the other DB-backed suites) ────────────────

let dbAvailable = false;
try {
	await Promise.race([
		db.select({ id: users.id }).from(users).limit(1),
		new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error("DB probe timeout")), 1500),
		),
	]);
	dbAvailable = true;
} catch {
	dbAvailable = false;
}

const describeDb = dbAvailable ? describe : describe.skip;

// ── App under test ───────────────────────────────────────────────────────
// Elysia wires `onError` only into routes registered AFTER the hook, so the
// shared handler goes first. (The production entrypoint currently registers it
// last; that is a pre-existing platform issue outside this module — see report.)

const app = new Elysia().onError(errorHandler).use(LoggerPlugin).use(modules);

// ── Fixtures ─────────────────────────────────────────────────────────────

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createdComplaintIds: string[] = [];

function uniqueDocNumber(): string {
	return `${Math.floor(Math.random() * 90_000_000) + 10_000_000}`;
}

function uniqueIp(): string {
	return `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
}

function validPayload(
	overrides: Partial<ComplaintModel["createBody"]> = {},
): ComplaintModel["createBody"] {
	return {
		type: "reclamo",
		fullName: `Test Buyer ${suffix}`,
		docType: "DNI",
		docNumber: uniqueDocNumber(),
		email: `complaints-${suffix}@example.com`,
		phone: "+51999888777",
		address: "Av. Test 123, Lima",
		description: "Producto llegó con la pantalla rota pese al embalaje correcto.",
		request: "Solicito el cambio del producto o la devolución del monto pagado.",
		...overrides,
	};
}

function postComplaint(payload: unknown) {
	return app.handle(
		new Request("http://localhost/api/v1/complaints/", {
			method: "POST",
			headers: { "content-type": "application/json", "x-forwarded-for": uniqueIp() },
			body: JSON.stringify(payload),
		}),
	);
}

afterAll(async () => {
	if (createdComplaintIds.length === 0) return;

	// The admin alert is fire-and-forget; give it a beat so its rows are
	// removed too (the local DB is a production copy — leave no test residue).
	await Bun.sleep(500);
	await db
		.delete(adminNotifications)
		.where(
			or(
				...createdComplaintIds.map((id) => sql`${adminNotifications.data}->>'complaintId' = ${id}`),
			),
		);
	await db.delete(complaints).where(inArray(complaints.id, createdComplaintIds));
});

// ── HTTP contract ────────────────────────────────────────────────────────

describeDb("complaints HTTP (DB)", () => {
	it("registers a valid complaint and returns 201 with an RB-XXXXXXXX code", async () => {
		const res = await postComplaint(validPayload());
		expect(res.status).toBe(201);

		const body = (await res.json()) as {
			id: string;
			code: string;
			status: string;
			createdAt: string;
		};
		expect(body.code).toMatch(/^RB-[A-Z0-9]{8}$/);
		expect(body.status).toBe("pending");
		expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(Number.isNaN(Date.parse(body.createdAt))).toBe(false);

		createdComplaintIds.push(body.id);
	});

	it("rejects a phone with letters (400)", async () => {
		const res = await postComplaint(validPayload({ phone: "abcdef" }));
		expect(res.status).toBe(400);

		const body = (await res.json()) as { code: string };
		expect(body.code).toBe("INPUT_VALIDATION_ERROR");
	});

	it("rejects a minor without guardian data (400)", async () => {
		const res = await postComplaint(validPayload({ isMinor: true }));
		expect(res.status).toBe(400);

		const body = (await res.json()) as { code: string };
		expect(body.code).toBe("INPUT_VALIDATION_ERROR");
	});

	it("accepts a minor when the guardian name and document are provided", async () => {
		const res = await postComplaint(
			validPayload({
				isMinor: true,
				guardianName: "Madre del menor",
				guardianDocNumber: uniqueDocNumber(),
			}),
		);
		expect(res.status).toBe(201);

		const body = (await res.json()) as { id: string; code: string };
		createdComplaintIds.push(body.id);
	});
});

// ── Admin contract (service level) ───────────────────────────────────────

describeDb("ComplaintService admin (DB)", () => {
	it("lists with status/search filters and paginates", async () => {
		const docNumber = uniqueDocNumber();
		const created = await ComplaintService.create(
			validPayload({ docNumber, fullName: `Admin List ${suffix}` }),
		);
		createdComplaintIds.push(created.id);

		const bySearch = await ComplaintService.listAdmin({ search: created.code, page: 0, limit: 10 });
		expect(bySearch.complaints.some((c) => c.id === created.id)).toBe(true);
		expect(bySearch.total).toBeGreaterThanOrEqual(1);

		const byDoc = await ComplaintService.listAdmin({ search: docNumber });
		expect(byDoc.complaints.some((c) => c.id === created.id)).toBe(true);

		const byStatus = await ComplaintService.listAdmin({ status: "pending", search: created.code });
		expect(byStatus.complaints.some((c) => c.id === created.id)).toBe(true);

		const wrongStatus = await ComplaintService.listAdmin({
			status: "responded",
			search: created.code,
		});
		expect(wrongStatus.complaints.some((c) => c.id === created.id)).toBe(false);
	});

	it("returns the detail and responds once, refusing a second response", async () => {
		const created = await ComplaintService.create(validPayload());
		createdComplaintIds.push(created.id);

		const detail = await ComplaintService.getByIdAdmin(created.id);
		expect(detail?.code).toBe(created.code);
		expect(detail?.status).toBe("pending");
		expect(detail?.respondedAt).toBeNull();

		const answered = await ComplaintService.respond(created.id, {
			responseText: "Se atendió el reclamo y se coordinó el cambio del producto.",
		});
		expect(answered.status).toBe("responded");
		expect(answered.responseText).toContain("Se atendió");
		expect(answered.respondedAt).not.toBeNull();

		try {
			await ComplaintService.respond(created.id, {
				responseText: "Segundo intento de respuesta que debe ser rechazado.",
			});
			expect.unreachable("second response should have been rejected");
		} catch (err) {
			expect((err as { statusCode?: number }).statusCode).toBe(422);
		}
	});

	it("returns null/404 for an unknown complaint", async () => {
		const missing = crypto.randomUUID();
		expect(await ComplaintService.getByIdAdmin(missing)).toBeNull();

		try {
			await ComplaintService.respond(missing, {
				responseText: "Respuesta a un reclamo inexistente.",
			});
			expect.unreachable("respond should have thrown");
		} catch (err) {
			expect((err as { statusCode?: number }).statusCode).toBe(404);
		}
	});

	it("caps pending complaints per document at 3", async () => {
		const docNumber = uniqueDocNumber();
		for (let i = 0; i < 3; i++) {
			const created = await ComplaintService.create(validPayload({ docNumber }));
			createdComplaintIds.push(created.id);
		}

		try {
			await ComplaintService.create(validPayload({ docNumber }));
			expect.unreachable("fourth pending complaint should have been rejected");
		} catch (err) {
			expect((err as { statusCode?: number }).statusCode).toBe(400);
		}
	});
});

// ── Admin guard ──────────────────────────────────────────────────────────

describeDb("complaints admin guard (DB)", () => {
	it("exposes the admin surface under /api/v1/admin/complaints with a guard hook", () => {
		const adminRoutes = app.routes.filter((route) =>
			route.path.startsWith("/api/v1/admin/complaints"),
		);

		const surface = adminRoutes.map((route) => `${route.method} ${route.path}`).sort();
		expect(surface).toEqual([
			"GET /api/v1/admin/complaints/",
			"GET /api/v1/admin/complaints/:id",
			"PATCH /api/v1/admin/complaints/:id",
		]);
		expect(adminRoutes.every((route) => Boolean(route.hooks.beforeHandle))).toBe(true);
	});

	it("rejects anonymous list/detail with 401", async () => {
		const id = crypto.randomUUID();

		const list = await app.handle(new Request("http://localhost/api/v1/admin/complaints/"));
		expect(list.status).toBe(401);

		const detail = await app.handle(new Request(`http://localhost/api/v1/admin/complaints/${id}`));
		expect(detail.status).toBe(401);
	});

	it("rejects anonymous PATCH before touching the complaint", async () => {
		const res = await app.handle(
			new Request(`http://localhost/api/v1/admin/complaints/${crypto.randomUUID()}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ responseText: "Respuesta anónima que no debe aplicarse." }),
			}),
		);
		// Schema-gated route: body validation can fire before the auth macro.
		expect([400, 401]).toContain(res.status);
	});
});
