import { ApiError, BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { getRedis } from "@/utils/redis";
import { adminStrictConfig, globalIpConfig, userStrictConfig } from "./config";
import { RedisContext } from "./redis-context";

const redisContext = new RedisContext(getRedis(), "rate-limit:");

/**
 * Smallest retry-after window across tiers (used when we can't tell which
 * tier fired). Tiers: globalIp 60s, userStrict 60s, adminStrict 60s.
 */
const RETRY_AFTER_SECONDS = 60;

/**
 * Composed rate-limit plugin.
 *
 * Creates a single shared RedisContext and registers three rate-limit tiers:
 * 1. globalIp  — 300 req / 60s (all routes)
 * 2. userStrict —  30 req / 60s (cart writes, order creation)
 * 3. adminStrict — 60 req / 60s (/api/v1/admin/*)
 *
 * Mount AFTER the CorsPlugin so CORS headers are present on 429 responses.
 *
 * The `.onError` hook fixes two lib quirks when `errorResponse` is an Error:
 *  - elysia-rate-limit does NOT write `RateLimit-*` / `Retry-After` headers
 *    on the `throw Error` path. We add them here.
 *  - The same `ApiError` instance is thrown for every 429, so the `errId`
 *    is shared. We re-throw a fresh `ApiError` to get a unique `errId`
 *    per 429 (needed for log/incident correlation).
 */
export const rateLimitPlugin = new Elysia({ name: "rate-limit" })
	.use(rateLimit({ ...globalIpConfig, context: redisContext }))
	.use(rateLimit({ ...userStrictConfig, context: redisContext }))
	.use(rateLimit({ ...adminStrictConfig, context: redisContext }))
	.onError(({ error, set }) => {
		if (error instanceof ApiError && error.code === BackendErrorCodes.RATE_LIMITED) {
			const resetAt = Math.floor(Date.now() / 1000) + RETRY_AFTER_SECONDS;
			set.headers["Retry-After"] = String(RETRY_AFTER_SECONDS);
			set.headers["X-RateLimit-Reset"] = String(resetAt);
			throw createApiError({
				code: BackendErrorCodes.RATE_LIMITED,
				message: error.message,
				logLevel: "warn",
			});
		}
	});
