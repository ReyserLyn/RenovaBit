import { db } from "@renovabit/db";
import { Elysia, type Static } from "elysia";
import { logger } from "../../utils/logger";
import { AppInfoSchema, HealthCheckDataSchema, HealthCheckErrorSchema } from "./model";

export const homeRoute = new Elysia({ name: "home" })
	// ── Root ──────────────────────────────────────
	.get(
		"/",
		() => {
			const payload: Static<typeof AppInfoSchema> = {
				app_name: "RenovaBit",
				app_env: process.env.NODE_ENV ?? "development",
				date: new Date().toISOString(),
			};

			return payload;
		},
		{
			response: {
				200: AppInfoSchema,
			},
			detail: {
				summary: "Raíz de la API",
				description: "Devuelve información básica sobre la API",
			},
		},
	)

	// ── Health Check ───────────────────────────────
	.get(
		"/health",
		async ({ set }) => {
			const healthStatus: Static<typeof HealthCheckDataSchema> = {
				status: "healthy",
				timestamp: new Date().toISOString(),
				services: {
					database: "healthy",
				},
			};

			try {
				await db.execute("select 1");
				healthStatus.services.database = "healthy";
			} catch (err) {
				healthStatus.services.database = "unhealthy";
				healthStatus.status = "degraded";
				logger.withError(err).warn("Health check: Database no responde");
			}

			if (healthStatus.status === "degraded") {
				set.status = 503;
				return healthStatus;
			}

			return healthStatus;
		},
		{
			response: {
				200: HealthCheckDataSchema,
				503: HealthCheckErrorSchema,
			},
			detail: {
				summary: "Health check",
				description: "Verifica el estado de salud de todos los servicios",
			},
		},
	);
