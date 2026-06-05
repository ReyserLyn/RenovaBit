import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import slugify from "slugify";

/**
 * Genera un slug URL-safe a partir de un string.
 * Usado por products, categories y brands.
 */
export function makeSlug(value: string): string {
	return slugify(value, { lower: true, strict: true, trim: true });
}

/**
 * Convierte errores de unique violation de PostgreSQL (código 23505)
 * en ApiError tipados. Evita 500s por race conditions en inserts/updates.
 *
 * Usar en `.catch()` de queries Drizzle que puedan violar constraints UNIQUE.
 */
export function handleUniqueViolation(error: unknown, fallbackMessage: string): never {
	if (
		error &&
		typeof error === "object" &&
		"code" in error &&
		(error as Record<string, unknown>).code === "23505"
	) {
		throw createApiError({
			code: BackendErrorCodes.EXISTS_ERROR,
			message: fallbackMessage,
			logLevel: "info",
			doNotLog: true,
		});
	}
	throw error;
}
