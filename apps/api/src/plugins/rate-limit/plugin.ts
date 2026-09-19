import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { getRedis } from "@/utils/redis";
import { adminStrictConfig, globalIpConfig, userStrictConfig } from "./config";
import { RedisContext } from "./redis-context";

const redisContext = new RedisContext(getRedis(), "rate-limit:");

/**
 * Composed rate-limit plugin.
 *
 * Creates a single shared RedisContext and registers three rate-limit tiers:
 * 1. globalIp  — 300 req / 60s (all routes)
 * 2. userStrict —  30 req / 60s (cart writes, order creation, complaints)
 * 3. adminStrict — 60 req / 60s (/api/v1/admin/*)
 *
 * Mount AFTER the CorsPlugin so CORS headers are present on 429 responses.
 *
 * 429 responses are produced by the `RateLimitedResponse` configured in
 * `config.ts` (a Response with a dynamic `clone()`), so the lib never throws
 * from its internal onError hook — that throw escaped Elysia's error chain
 * and surfaced as Bun's dev error page.
 *
 * Functional (not instance) plugin: the key generators need the real Bun
 * server for the socket-address fallback, and only the app passed to a
 * functional plugin exposes it. An `Elysia` instance created here would have
 * `server === null` forever, collapsing every proxy-less request into the
 * shared "anonymous" bucket.
 */
export const rateLimitPlugin = (app: Elysia) => {
	const injectServer = () => app.server;

	return app.use(
		new Elysia({ name: "rate-limit" })
			.use(rateLimit({ ...globalIpConfig, context: redisContext, injectServer }))
			.use(rateLimit({ ...userStrictConfig, context: redisContext, injectServer }))
			.use(rateLimit({ ...adminStrictConfig, context: redisContext, injectServer })),
	);
};
