/**
 * ReportsService list/detail integration tests.
 *
 * Regression coverage for the admin sync-reports screen:
 *   - list returns newest-first plus the real total (not just the page size)
 *   - the list carries a compact stats summary
 *   - the status filter narrows both rows and total
 *   - detail returns the COMPLETE rich stats (failedItems, ai, images, …)
 *   - unknown ids return null, which the route turns into a 404
 *
 * Strategy: connect to the dev DB, create isolated sync report fixtures with
 * unique jobIds and clean them up in `afterEach`.
 *
 * Prerequisites:
 *   - Dev Postgres must be running (`docker compose -f docker-compose.dev.yaml up -d`)
 *   - The `DATABASE_URL` env var must point to the dev DB (loaded from packages/db/.env)
 */
import { afterEach, describe, expect, it } from "bun:test";
import { db } from "@renovabit/db";
import { type SyncStats, syncReports, users } from "@renovabit/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { MAX_PAGE_SIZE } from "@/constants";
import { ReportsService } from "../service";

// ── Helpers ──────────────────────────────────────────────

function uniqueSuffix(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Fixtures are dated in the future so they sort at the top of the table. */
const FUTURE_BASE_MS = Date.now() + 60 * 60 * 1000;

function futureDate(minutes: number): Date {
	return new Date(FUTURE_BASE_MS + minutes * 60_000);
}

/**
 * DB-dependent describes are skipped when no DB is available (e.g. CI sandbox
 * without Postgres). Probing the real connection (not just `DATABASE_URL`
 * presence) is required because Bun auto-loads `.env`, so the env var is set
 * even in sandboxes that have no actual Postgres.
 */
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

// ── Fixtures ─────────────────────────────────────────────

const FULL_STATS: SyncStats = {
	processed: 12,
	created: 3,
	updated: 4,
	unchanged: 5,
	errors: 2,
	outOfStock: 1,
	failedItems: [
		{ providerId: "P-1", reason: "Precio inválido" },
		{ providerId: "P-2", reason: "Timeout del proveedor" },
	],
	ai: { calls: 7, failed: 1, inputTokens: 1500, outputTokens: 800, costUsd: 0.0123 },
	images: { checked: 9, processed: 6, missing: 2 },
	unavailableMarked: 4,
	zeroingSkipped: true,
	blacklistedRemoved: 2,
	durationMs: 154_000,
};

const createdReportIds: string[] = [];

async function createReport(input: {
	status: "running" | "completed" | "failed";
	startedAt: Date;
	stats?: SyncStats;
	errorMessage?: string;
}): Promise<string> {
	const [row] = await db
		.insert(syncReports)
		.values({
			jobId: `test-report-${uniqueSuffix()}`,
			trigger: "manual",
			status: input.status,
			stats: input.stats ?? FULL_STATS,
			errorMessage: input.errorMessage ?? null,
			startedAt: input.startedAt,
			completedAt: input.status === "running" ? null : new Date(input.startedAt.getTime() + 60_000),
		})
		.returning({ id: syncReports.id });

	if (!row) throw new Error("No se pudo crear el fixture de reporte");

	createdReportIds.push(row.id);
	return row.id;
}

afterEach(async () => {
	if (createdReportIds.length > 0) {
		await db.delete(syncReports).where(inArray(syncReports.id, createdReportIds));
		createdReportIds.length = 0;
	}
});

// ── DB-dependent tests ───────────────────────────────────

describeDb("ReportsService.listReports (DB)", () => {
	it("lists reports newest-first and returns the real total count", async () => {
		const oldest = await createReport({ status: "completed", startedAt: futureDate(0) });
		const middle = await createReport({
			status: "failed",
			startedAt: futureDate(1),
			errorMessage: "boom",
		});
		const newest = await createReport({ status: "running", startedAt: futureDate(2) });

		const result = await ReportsService.listReports({ page: 1, limit: MAX_PAGE_SIZE });

		const ids = result.reports.map((report) => report.id);
		const positions = [ids.indexOf(newest), ids.indexOf(middle), ids.indexOf(oldest)];
		expect(positions).not.toContain(-1);
		expect(positions[0]).toBeLessThan(positions[1]!);
		expect(positions[1]).toBeLessThan(positions[2]!);

		const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(syncReports);
		expect(result.total).toBe(Number(countRow?.count ?? 0));
	});

	it("projects a compact stats summary in the list", async () => {
		const reportId = await createReport({ status: "completed", startedAt: futureDate(10) });

		const result = await ReportsService.listReports({ page: 1, limit: MAX_PAGE_SIZE });
		const report = result.reports.find((row) => row.id === reportId);

		expect(report?.stats).toEqual({
			processed: 12,
			created: 3,
			updated: 4,
			unchanged: 5,
			errors: 2,
			outOfStock: 1,
			failedCount: 2,
			aiCostUsd: 0.0123,
			durationMs: 154_000,
		});
	});

	it("filters by status and counts only the filtered rows", async () => {
		const failedId = await createReport({
			status: "failed",
			startedAt: futureDate(20),
			errorMessage: "boom",
		});
		const completedId = await createReport({ status: "completed", startedAt: futureDate(21) });

		const result = await ReportsService.listReports({
			page: 1,
			limit: MAX_PAGE_SIZE,
			status: "failed",
		});

		expect(result.reports.every((report) => report.status === "failed")).toBe(true);
		expect(result.reports.some((report) => report.id === failedId)).toBe(true);
		expect(result.reports.some((report) => report.id === completedId)).toBe(false);

		const [countRow] = await db
			.select({ count: sql<number>`count(*)` })
			.from(syncReports)
			.where(eq(syncReports.status, "failed"));
		expect(result.total).toBe(Number(countRow?.count ?? 0));
	});
});

describeDb("ReportsService.getReportById (DB)", () => {
	it("returns the complete rich stats for a report", async () => {
		const reportId = await createReport({
			status: "failed",
			startedAt: futureDate(30),
			errorMessage: "Fallo del proveedor",
		});

		const report = await ReportsService.getReportById(reportId);

		expect(report).not.toBeNull();
		expect(report?.status).toBe("failed");
		expect(report?.errorMessage).toBe("Fallo del proveedor");
		expect(report?.startedAt).toBeInstanceOf(Date);
		expect(report?.stats).toEqual(FULL_STATS);
	});

	it("returns null for an unknown report id (the route turns it into a 404)", async () => {
		const report = await ReportsService.getReportById(crypto.randomUUID());
		expect(report).toBeNull();
	});
});
