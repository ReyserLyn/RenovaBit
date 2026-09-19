/**
 * Authorization contract for the admin surface.
 *
 * Every /api/v1/admin route must reject anonymous requests. Two layers:
 *
 * 1. Static: every admin route must carry the compiled auth macro (beforeHandle
 *    hook). Schema-independent, covers the whole surface — including routes
 *    whose body/query schema is validated before the macro runs.
 * 2. Dynamic: anonymous HTTP requests are rejected end-to-end (401), except for
 *    schema-gated routes where Elysia validates the payload first (400). Both
 *    are rejections; the static layer is the guard-presence guarantee.
 *
 * The app is composed without side-effectful plugins (jobs, rate-limit,
 * Bull-Board, shutdown). LoggerPlugin IS included: it is part of the HTTP layer
 * and its hooks let macro-thrown ApiErrors reach the shared error handler
 * (verified against production behavior, which returns the same 401 payload).
 */
import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { modules } from "@/modules";
import { errorHandler } from "@/plugins/error-handler";
import { LoggerPlugin } from "@/plugins/logger";

const app = new Elysia().use(LoggerPlugin).use(modules).onError(errorHandler);

/**
 * The canonical Better Auth catch-all (/api/v1/auth*) is a public handler by
 * design and not part of the guarded API surface. It must be mounted exactly
 * once, outside module prefixes (asserted below).
 */
const isAuthHandlerRoute = (path: string) => path.includes("/auth*");

const adminRoutes = app.routes.filter(
	(route) =>
		route.path.startsWith("/api/v1/admin") &&
		route.method !== "HEAD" &&
		route.method !== "OPTIONS" &&
		!isAuthHandlerRoute(route.path),
);

/**
 * Routes whose request schema is validated before the auth macro runs (Elysia
 * validates body/query before the macro resolve). An anonymous request with an
 * empty payload gets 400 here instead of 401. They remain guarded: the static
 * assertion fails if the macro ever disappears from any of them.
 */
const SCHEMA_GATED_ROUTES = new Set([
	"POST /api/v1/admin/brands/",
	"POST /api/v1/admin/brands/bulk",
	"POST /api/v1/admin/categories/",
	"POST /api/v1/admin/categories/bulk",
	"POST /api/v1/admin/margin-rules/",
	"POST /api/v1/admin/offers/",
	"POST /api/v1/admin/offers/:id/products",
	"PATCH /api/v1/admin/complaints/:id",
	"PATCH /api/v1/admin/orders/:id",
	"PATCH /api/v1/admin/orders/:id/attachments",
	"POST /api/v1/admin/orders/batch",
	"GET /api/v1/admin/product-images/",
	"POST /api/v1/admin/product-images/",
	"POST /api/v1/admin/products/",
	"POST /api/v1/admin/products/bulk",
	"DELETE /api/v1/admin/scraping/blacklist",
	"POST /api/v1/admin/scraping/blacklist",
	"POST /api/v1/admin/storage/presign",
]);

const PARAM_PLACEHOLDER = "00000000-0000-7000-8000-000000000000";

function requestPath(path: string): string {
	return path.replace(/:[^/]+/g, PARAM_PLACEHOLDER);
}

describe("authorization contract — admin surface", () => {
	it("enumerates the admin route surface (guards against broken enumeration)", () => {
		expect(adminRoutes.length).toBeGreaterThanOrEqual(55);
	});

	it("every admin route carries the compiled auth macro (beforeHandle hook)", () => {
		const missingGuard = adminRoutes
			.filter((route) => !route.hooks.beforeHandle)
			.map((route) => `${route.method} ${route.path}`);

		expect(missingGuard).toEqual([]);
	});

	it("mounts the Better Auth catch-all exactly once, outside module prefixes", () => {
		const authCatchAlls = app.routes
			.filter((route) => route.path.endsWith("/auth*"))
			.map((route) => `${route.method} ${route.path}`);

		expect(authCatchAlls).toEqual(["ALL /api/v1/auth*"]);
	});

	it("admin users mount exposes only the admin list route (no isAuth-only /me leak)", () => {
		const userRoutes = app.routes
			.filter((route) => route.path.startsWith("/api/v1/admin/users"))
			.map((route) => `${route.method} ${route.path}`);

		expect(userRoutes).toEqual(["GET /api/v1/admin/users/"]);
	});

	it("does not expose the user-scoped /me handlers under /api/v1/admin", async () => {
		const res = await app.handle(new Request("http://localhost/api/v1/admin/users/me"));

		expect(res.status).toBe(404);
	});

	it("keeps /api/v1/users/me mounted for the storefront", async () => {
		const res = await app.handle(new Request("http://localhost/api/v1/users/me"));

		expect(res.status).toBe(401);
	});

	it("schema-gated allowlist stays in sync with the route table", () => {
		const routeKeys = new Set(adminRoutes.map((route) => `${route.method} ${route.path}`));
		const stale = [...SCHEMA_GATED_ROUTES].filter((key) => !routeKeys.has(key));

		expect(stale).toEqual([]);
	});

	for (const route of adminRoutes) {
		const key = `${route.method} ${route.path}`;
		const accepted = SCHEMA_GATED_ROUTES.has(key) ? [400, 401] : [401];

		it(`${route.method} ${route.path} rejects anonymous requests`, async () => {
			const method = route.method === "ALL" ? "GET" : route.method;
			const res = await app.handle(
				new Request(`http://localhost${requestPath(route.path)}`, {
					method,
					...(method === "GET"
						? {}
						: { headers: { "content-type": "application/json" }, body: "{}" }),
				}),
			);

			expect(accepted).toContain(res.status);
		});
	}

	it("control: a public catalog route is not auth-blocked", async () => {
		const res = await app.handle(new Request("http://localhost/api/v1/products"));

		expect(res.status).not.toBe(401);
	});
});
