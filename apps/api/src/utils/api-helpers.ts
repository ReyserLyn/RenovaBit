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

/**
 * Retorna un ApiError 404 como valor (no throw). Útil en la capa de servicios
 * donde quieres lanzar un error tipado sin repetir el bloque createApiError.
 *
 * Uso: throw notFoundApiError("Producto no encontrado")
 */
export function notFoundApiError(message: string): never {
	throw createApiError({
		code: BackendErrorCodes.NOT_FOUND_ERROR,
		message,
		logLevel: "info",
		doNotLog: true,
	});
}

/**
 * Retorna un ApiError de validación (422) como valor para servicios.
 * Uso: throw validationError("El campo X es requerido")
 */
export function validationError(message: string): never {
	throw createApiError({
		code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
		message,
		logLevel: "info",
		doNotLog: true,
	});
}

/**
 * Retorna un ApiError de conflicto (409) como valor para servicios.
 * Uso: throw conflictError("Ya existe un recurso con este identificador")
 */
export function conflictError(message: string): never {
	throw createApiError({
		code: BackendErrorCodes.CONFLICT,
		message,
		logLevel: "info",
		doNotLog: true,
	});
}
