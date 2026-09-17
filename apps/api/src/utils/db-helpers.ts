import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import slugify from "slugify";
import { logger } from "@/utils/logger";
import { deleteEntityFolder } from "@/utils/storage/helpers";

/**
 * Genera un slug URL-safe a partir de un string.
 * Usado por products, categories y brands.
 */
export function makeSlug(value: string): string {
	return slugify(value, { lower: true, strict: true, trim: true });
}

/**
 * Walks the `cause` chain to find the underlying PostgreSQL error node.
 *
 * Drizzle wraps driver errors in `DrizzleQueryError`, so the pg fields
 * (`code`, `constraint_name`, `message`) live in `cause`, never at the top
 * level. postgres-js also exposes the constraint as `constraint_name`, not
 * `constraint`.
 */
function findPgCause(error: unknown): Record<string, unknown> | null {
	const seen = new Set<unknown>();
	let current: unknown = error;

	while (current && typeof current === "object" && !seen.has(current)) {
		seen.add(current);
		if (typeof Reflect.get(current as object, "code") === "string") {
			return current as Record<string, unknown>;
		}
		current = Reflect.get(current as object, "cause");
	}

	return null;
}

/**
 * Convierte errores de unique violation de PostgreSQL (código 23505)
 * en ApiError tipados. Evita 500s por race conditions en inserts/updates.
 *
 * Usar en `.catch()` de queries Drizzle que puedan violar constraints UNIQUE.
 */
export function handleUniqueViolation(error: unknown, fallbackMessage: string): never {
	const pgError = findPgCause(error);
	if (pgError && Reflect.get(pgError, "code") === "23505") {
		throw createApiError({
			code: BackendErrorCodes.EXISTS_ERROR,
			message: fallbackMessage,
			logLevel: "info",
			doNotLog: true,
		});
	}
	throw error;
}

/**
 * Helper para detectar unique violation en PostgreSQL por nombre de constraint.
 * Reemplaza las funciones duplicadas isOrderNumberUniqueViolation / isCartIdUniqueViolation
 * en orders/service.ts.
 *
 * Uso:
 * ```ts
 * if (isUniqueViolationOn(err, "orders_order_number_unique")) { ... }
 * ```
 */
export function isUniqueViolationOn(error: unknown, constraintName: string): boolean {
	const pgError = findPgCause(error);
	if (!pgError || Reflect.get(pgError, "code") !== "23505") return false;

	const constraint = Reflect.get(pgError, "constraint");
	const constraintNameSnake = Reflect.get(pgError, "constraint_name");
	const message = Reflect.get(pgError, "message");
	return (
		constraint === constraintName ||
		constraintNameSnake === constraintName ||
		(typeof message === "string" && message.includes(constraintName))
	);
}

/**
 * Ejecuta cleanup de R2 para una lista de IDs eliminados.
 * Extraído del patrón repetido en products, brands y categories.
 *
 * @param folder — Nombre de carpeta en R2 ("products", "brands", "categories")
 * @param ids — IDs a limpiar
 */
export function cleanupEntityFolders(folder: string, ids: string[]): void {
	for (const id of ids) {
		deleteEntityFolder(folder, id).catch((err) =>
			logger
				.withMetadata({ entity: folder, id })
				.withError(err)
				.error(`[R2 cleanup] Failed to delete folder for ${folder}/${id}`),
		);
	}
}
