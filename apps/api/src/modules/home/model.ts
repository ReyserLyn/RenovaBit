import { t } from "elysia";

// ── App Info ──────────────────────────────────────────

export const AppInfoSchema = t.Object({
	app_name: t.String({ description: "Nombre de la aplicación" }),
	app_env: t.String({ description: "Environment actual" }),
	date: t.String({ description: "Fecha actual del servidor" }),
});

// ── Health ─────────────────────────────────────────────

const ServiceStatus = t.Union([t.Literal("ok"), t.Literal("down")]);
const OverallStatus = t.Union([t.Literal("ok"), t.Literal("degraded")]);

export const HealthCheckSchema = t.Object({
	status: OverallStatus,
	timestamp: t.String({ description: "Fecha y hora de la verificación" }),
	services: t.Object({
		database: ServiceStatus,
		redis: ServiceStatus,
	}),
});
