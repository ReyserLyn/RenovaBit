/**
 * Platform error contract — locks the composed app behavior for API errors.
 *
 * IMPORTANT: LoggerPlugin is here ON PURPOSE. Empirically (Elysia 1.4.x),
 * macro-thrown ApiErrors only reach the shared error handler when the
 * composition includes a plugin-scoped onError hook (@loglayer/elysia
 * provides one) alongside the root onError. Removing or reordering
 * LoggerPlugin without re-verifying this suite can silently turn auth
 * failures into 500s with plain-text bodies.
 */
import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { modules } from "@/modules";
import { errorHandler } from "@/plugins/error-handler";
import { LoggerPlugin } from "@/plugins/logger";
import { SecurityHeadersPlugin } from "@/plugins/security-headers";

const app = new Elysia()
	.use(LoggerPlugin)
	.use(SecurityHeadersPlugin)
	.use(modules)
	.onError(errorHandler);

describe("platform error contract", () => {
	it("maps macro-thrown auth errors to 401 INVALID_CREDENTIALS", async () => {
		const res = await app.handle(new Request("http://localhost/api/v1/admin/offers/"));

		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ code: "INVALID_CREDENTIALS" });
	});

	it("maps unknown routes to 404 NOT_FOUND", async () => {
		const res = await app.handle(new Request("http://localhost/api/v1/does-not-exist"));

		expect(res.status).toBe(404);
		expect(await res.json()).toMatchObject({ code: "NOT_FOUND" });
	});

	it("maps body validation errors to 400 INPUT_VALIDATION_ERROR", async () => {
		const res = await app.handle(
			new Request("http://localhost/api/v1/admin/offers/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{}",
			}),
		);

		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ code: "INPUT_VALIDATION_ERROR" });
	});
});
