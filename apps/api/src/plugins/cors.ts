import { cors } from "@elysiajs/cors";
import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia } from "elysia";
import { appOrigins } from "@/utils/origins";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const DEV_ORIGINS = [
	"http://localhost:3000", // landing
	"http://localhost:3001", // api
	"http://localhost:3002", // admin
	"http://localhost:3003", // tienda
	"http://127.0.0.1:3000",
	"http://127.0.0.1:3001",
	"http://127.0.0.1:3002",
	"http://127.0.0.1:3003",
];

function isTrustedOrigin(origin: string | null): boolean {
	if (!origin) return false;

	// En dev solo permitimos hosts loopback explícitos.
	if (process.env.NODE_ENV !== "production") {
		return DEV_ORIGINS.includes(origin);
	}

	try {
		const parsed = new URL(origin);
		return appOrigins.some((o) => {
			if (typeof o !== "string") return false;
			try {
				const allowed = new URL(o);
				return allowed.origin === parsed.origin || parsed.hostname.endsWith(`.${allowed.hostname}`);
			} catch {
				return o === parsed.origin;
			}
		});
	} catch {
		return false;
	}
}

export const CorsPlugin = new Elysia({ name: "cors" })
	.use(
		cors({
			origin: process.env.NODE_ENV === "production" ? appOrigins : DEV_ORIGINS,
			methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			exposeHeaders: ["x-retry-after", "x-guest-token"],
			credentials: true,
			maxAge: 86400,
		}),
	)
	// Extra Origin validation for mutating methods (POST/PUT/PATCH/DELETE).
	//
	// This plugin defines no routes, so a scoped `onBeforeHandle` would never
	// run; `onRequest` is global by nature and executes before body validation.
	// The rejection is RETURNED (with status 403) instead of thrown because the
	// root `.onError(errorHandler)` is registered after the module routes, so
	// thrown errors would surface as plain-text 500s instead of the project's
	// error contract. Requests WITHOUT an Origin header are server-to-server
	// callers (tienda/admin SSR fetches, curl, health checks, cron) and cannot
	// be CSRF; only browser-originated requests are checked. OPTIONS preflight
	// is excluded by the method filter (and answered by @elysiajs/cors).
	.onRequest(({ request, set }) => {
		if (!MUTATING_METHODS.has(request.method)) return;

		const origin = request.headers.get("origin");
		if (!origin) return;
		if (isTrustedOrigin(origin)) return;

		const error = createApiError({
			code: BackendErrorCodes.ACCESS_DENIED,
			message: "Origin no autorizado para esta operación",
			logLevel: "info",
			doNotLog: true,
		});
		set.status = error.statusCode;
		return error.toJSONSafe();
	});
