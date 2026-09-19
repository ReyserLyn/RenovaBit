import { logger } from "@/utils/logger";

/**
 * Environment contract for the API.
 *
 * Boot fails fast when a required key is missing so the container logs show one
 * readable message instead of a confusing crash from deep inside a dependency.
 * Optional keys only degrade a feature and are logged as warnings.
 */

/** Keys the API cannot run without in any environment. */
const REQUIRED_ALWAYS = ["DATABASE_URL"] as const;

/**
 * Keys required in production. Missing ones would either break security
 * (auth secret), take user-facing features offline (storage) or break browser
 * access entirely (CORS/trusted origins), so they must not pass silently.
 */
const REQUIRED_IN_PRODUCTION = [
	"BETTER_AUTH_SECRET",
	"R2_ACCOUNT_ID",
	"R2_ACCESS_KEY_ID",
	"R2_SECRET_ACCESS_KEY",
	"R2_BUCKET_NAME",
	"R2_PUBLIC_URL",
	"API_URL",
	"ADMIN_URL",
	"STORE_URL",
	"LANDING_URL",
] as const;

/** Keys that only disable a feature (warn, never block boot). */
const RECOMMENDED = ["OPENROUTER_API_KEY"] as const;

export type EnvIssue = {
	key: string;
	severity: "error" | "warning";
};

export function collectEnvIssues(env: NodeJS.ProcessEnv = process.env): EnvIssue[] {
	const isProduction = env.NODE_ENV === "production";
	const issues: EnvIssue[] = [];

	for (const key of REQUIRED_ALWAYS) {
		if (!env[key]) issues.push({ key, severity: "error" });
	}

	if (isProduction) {
		for (const key of REQUIRED_IN_PRODUCTION) {
			if (!env[key]) issues.push({ key, severity: "error" });
		}
	}

	for (const key of RECOMMENDED) {
		if (!env[key]) issues.push({ key, severity: "warning" });
	}

	return issues;
}

/**
 * Validates the environment. Throws a single aggregated error listing every
 * missing required key when the boot must stop.
 */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
	const issues = collectEnvIssues(env);
	const errors = issues.filter((issue) => issue.severity === "error");
	const warnings = issues.filter((issue) => issue.severity === "warning");

	for (const warning of warnings) {
		logger.warn(
			`Env: falta ${warning.key} — la funcionalidad que depende de ella quedará deshabilitada`,
		);
	}

	if (errors.length > 0) {
		const keys = errors.map((issue) => issue.key).join(", ");
		const scope = env.NODE_ENV === "production" ? " en producción" : "";
		throw new Error(`Faltan variables de entorno obligatorias${scope}: ${keys}`);
	}
}
