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
	// Validación extra de Origin en métodos mutantes (POST/PUT/PATCH/DELETE)
	.onBeforeHandle(({ request }) => {
		if (!MUTATING_METHODS.has(request.method)) return;

		const origin = request.headers.get("origin");
		if (!isTrustedOrigin(origin)) {
			throw createApiError({
				code: BackendErrorCodes.ACCESS_DENIED,
				message: "Origin no autorizado para esta operación",
				logLevel: "info",
				doNotLog: true,
			});
		}
	});
