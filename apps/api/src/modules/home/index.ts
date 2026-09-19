import { db } from "@renovabit/db";
import { sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { logger } from "@/utils/logger";
import { getRedis } from "@/utils/redis";
import { AppInfoSchema, HealthCheckSchema } from "./model";

type HealthCheck = (typeof HealthCheckSchema)["static"];
type ServiceKey = "database" | "redis";

const HEALTH_TIMEOUT_MS = 2_000;

async function checkWithTimeout(
	key: ServiceKey,
	probe: () => Promise<unknown>,
	health: HealthCheck,
): Promise<void> {
	try {
		await Promise.race([
			probe(),
			new Promise<never>((_, reject) => {
				const timer = setTimeout(() => {
					reject(new Error(`${key} health check timed out after ${HEALTH_TIMEOUT_MS}ms`));
				}, HEALTH_TIMEOUT_MS);
				timer.unref();
			}),
		]);
	} catch (err) {
		health.services[key] = "down";
		health.status = "degraded";
		logger.withMetadata({ service: key }).withError(err).warn("Health check failed");
	}
}

export const homeRoute = new Elysia({ name: "home" })
	.get(
		"/",
		() => ({
			app_name: "Renovabit",
			app_env: process.env.NODE_ENV ?? "development",
			date: new Date().toISOString(),
		}),
		{
			response: { 200: AppInfoSchema },
			detail: {
				summary: "Raíz de la API",
				description: "Devuelve información básica sobre la API",
			},
		},
	)
	.get(
		"/health",
		async ({ set }) => {
			const health: HealthCheck = {
				status: "ok",
				timestamp: new Date().toISOString(),
				services: { database: "ok", redis: "ok" },
			};

			await checkWithTimeout("database", () => db.execute(sql`SELECT 1`), health);
			await checkWithTimeout(
				"redis",
				() => {
					// A Redis client that is not connected queues the ping until the
					// connection succeeds, which hangs this endpoint (and the deploy
					// health gate) for as long as Redis is unreachable. Report it down
					// now instead of waiting.
					const redis = getRedis();
					if (redis.status !== "ready") {
						return Promise.reject(new Error(`redis client is ${redis.status}`));
					}
					return redis.ping();
				},
				health,
			);

			if (health.status === "degraded") set.status = 503;
			return health;
		},
		{
			response: { 200: HealthCheckSchema, 503: HealthCheckSchema },
			detail: {
				summary: "Health check",
				description: "Chequea DB y Redis. 503 si alguno está caído.",
			},
		},
	);
