import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import type { Options } from "elysia-rate-limit";
import { resolveClientKey, skipAdminStrict, skipGlobalIp, skipUserStrict } from "./keys";

/**
 * Global-IP tier: 300 requests per 60-second sliding window.
 * Applies to every non-excluded route.
 */
export const globalIpConfig: Partial<Options> = {
	duration: 60_000,
	max: 300,
	errorResponse: createApiError({
		code: BackendErrorCodes.RATE_LIMITED,
		message: "Demasiadas solicitudes. Intenta de nuevo en unos segundos.",
		logLevel: "warn",
	}),
	skip: skipGlobalIp,
	generator: (req) => `global-ip:${resolveClientKey(req)}`,
	scoping: "global",
	countFailedRequest: false,
};

/**
 * User-strict tier: 30 requests per 60-second sliding window.
 * Applies to cart POST/PATCH/DELETE and orders POST only.
 */
export const userStrictConfig: Partial<Options> = {
	duration: 60_000,
	max: 30,
	errorResponse: createApiError({
		code: BackendErrorCodes.RATE_LIMITED,
		message: "Demasiadas solicitudes. Intenta de nuevo en unos segundos.",
		logLevel: "warn",
	}),
	skip: skipUserStrict,
	generator: (req) => `user-strict:${resolveClientKey(req)}`,
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
	errorResponse: createApiError({
		code: BackendErrorCodes.RATE_LIMITED,
		message: "Demasiadas solicitudes. Intenta de nuevo en unos segundos.",
		logLevel: "warn",
	}),
	skip: skipAdminStrict,
	generator: (req) => `admin-strict:${resolveClientKey(req)}`,
	scoping: "global",
	countFailedRequest: false,
};
