import { t } from "elysia";

export const AppInfoSchema = t.Object({
	app_name: t.String({ description: "Nombre de la aplicación" }),
	app_env: t.String({ description: "Environment actual" }),
	date: t.String({ description: "Fecha actual del servidor" }),
});

export const HealthCheckDataSchema = t.Object({
	status: t.String({ description: "Estado general de salud" }),
	timestamp: t.String({ description: "Fecha y hora de la verificación" }),
	services: t.Object({
		database: t.String({ description: "Estado de conexión a la base de datos" }),
	}),
});

export const HealthCheckErrorSchema = t.Object({
	status: t.String({ description: "Estado de error" }),
	timestamp: t.String({ description: "Fecha y hora de la verificación" }),
	services: t.Object({
		database: t.String({ description: "Estado de conexión a la base de datos" }),
	}),
});
