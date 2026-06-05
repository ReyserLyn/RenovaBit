import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";

/**
 * Lanza un ApiError 404 con el mensaje dado.
 * Uso: throw notFound("Producto no encontrado")
 */
export function notFound(message: string): never {
	throw createApiError({
		code: BackendErrorCodes.NOT_FOUND_ERROR,
		message,
		logLevel: "info",
		doNotLog: true,
	});
}
