import { db } from "@renovabit/db";
import { sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { getRedis } from "@/utils/redis";
import { AppInfoSchema, HealthCheckSchema } from "./model";

type HealthCheck = (typeof HealthCheckSchema)["static"];
type ServiceKey = "database" | "redis";

async function checkService(
	key: ServiceKey,
	probe: () => Promise<unknown>,
	health: HealthCheck,
): Promise<void> {
	try {
		await probe();
	} catch {
		health.services[key] = "down";
		health.status = "degraded";
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

			await checkService("database", () => db.execute(sql`SELECT 1`), health);
			await checkService("redis", () => getRedis().ping(), health);

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
