import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import type { Options } from "elysia-rate-limit";
import { resolveClientKey, skipAdminStrict, skipGlobalIp, skipUserStrict } from "./keys";

const RATE_LIMITED_MESSAGE = "Demasiadas solicitudes. Intenta de nuevo en unos segundos.";

/**
 * 429 response used as `errorResponse` for every tier.
 *
 * `elysia-rate-limit` clones this instance for each rejection; overriding
 * `clone()` gives every 429 a fresh `errId` while the lib still writes its
 * `RateLimit-*` / `Retry-After` headers on the clone.
 *
 * A Response (not an Error) is intentional: with an Error, the lib throws it
 * from inside its own `onError` hook, which escapes Elysia's error chain and
 * surfaced as Bun's dev error page (validation/404 rate-limit paths).
 */
class RateLimitedResponse extends Response {
	readonly #message: string;

	constructor(message: string) {
		super(null, { status: 429, headers: { "content-type": "application/json" } });
		this.#message = message;
	}

	// `clone` is a property (not a method) on the Response interface, so it is
	// declared as an instance field to keep the override type-compatible.
	override clone: () => Response = () => {
		const error = createApiError({
			code: BackendErrorCodes.RATE_LIMITED,
			message: this.#message,
			logLevel: "warn",
		});
		return new Response(JSON.stringify(error.toJSONSafe()), {
			status: 429,
			headers: { "content-type": "application/json" },
		});
	};
}

const rateLimitedResponse = new RateLimitedResponse(RATE_LIMITED_MESSAGE);

/**
 * Global-IP tier: 300 requests per 60-second sliding window.
 * Applies to every non-excluded route.
 */
export const globalIpConfig: Partial<Options> = {
	duration: 60_000,
	max: 300,
	errorResponse: rateLimitedResponse,
	skip: skipGlobalIp,
	generator: (req, server) => `global-ip:${resolveClientKey(req, server)}`,
	scoping: "global",
	countFailedRequest: false,
};

/**
 * User-strict tier: 30 requests per 60-second sliding window.
 * Applies to cart POST/PATCH/DELETE, orders POST and complaints POST only.
 */
export const userStrictConfig: Partial<Options> = {
	duration: 60_000,
	max: 30,
	errorResponse: rateLimitedResponse,
	skip: skipUserStrict,
	generator: (req, server) => `user-strict:${resolveClientKey(req, server)}`,
	scoping: "global",
	countFailedRequest: false,
};

/**
 * Admin-strict tier: 60 requests per 60-second sliding window.
 * Applies only to /api/v1/admin/* routes.
 */
export const adminStrictConfig: Partial<Options> = {
	duration: 60_000,
	max: 60,
	errorResponse: rateLimitedResponse,
	skip: skipAdminStrict,
	generator: (req, server) => `admin-strict:${resolveClientKey(req, server)}`,
	scoping: "global",
	countFailedRequest: false,
};
