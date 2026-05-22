export type BackendErrorCode =
	| "ACCESS_DENIED"
	| "BAD_REQUEST"
	| "CONFLICT"
	| "EXISTS_ERROR"
	| "INPUT_VALIDATION_ERROR"
	| "INTERNAL_SERVER_ERROR"
	| "INVALID_CREDENTIALS"
	| "NOT_FOUND_ERROR"
	| "RATE_LIMITED"
	| "SERVICE_UNAVAILABLE"
	| "UNPROCESSABLE_ENTITY";

export interface ApiErrorResponse {
	errId: string;
	code: BackendErrorCode;
	message: string;
	statusCode: number;
	metadata?: Record<string, unknown>;
	validationError?: {
		validation: Array<{ message: string; path: string }>;
		validationContext: string;
		message: string;
	};
}

export class ApiClientError extends Error {
	errId: string;
	code: BackendErrorCode;
	statusCode: number;
	metadata?: Record<string, unknown>;
	validationError?: ApiErrorResponse["validationError"];

	constructor(response: ApiErrorResponse) {
		super(response.message);
		this.name = "ApiClientError";
		this.errId = response.errId;
		this.code = response.code;
		this.statusCode = response.statusCode;
		this.metadata = response.metadata;
		this.validationError = response.validationError;
	}
}

export function isApiClientError(error: unknown): error is ApiClientError {
	return error instanceof ApiClientError;
}

/**
 * Extrae un ApiClientError tipado desde un error de Eden Treaty.
 * Devuelve null si el error no tiene el shape esperado.
 */
export function extractApiError(error: unknown): ApiClientError | null {
	if (error && typeof error === "object" && "value" in error) {
		const value = (error as { value: unknown }).value;
		if (
			value &&
			typeof value === "object" &&
			"errId" in value &&
			"code" in value &&
			"message" in value &&
			"statusCode" in value
		) {
			return new ApiClientError(value as ApiErrorResponse);
		}
	}
	return null;
}

/**
 * Envuelve una llamada a Eden Treaty para devolver solo `data`
 * o lanzar un `ApiClientError` (o Error genérico).
 * Compatible con TanStack Query — espera que los errores se lancen.
 */
export async function unwrapResponse<T>(
	promise: Promise<{ data: T | null; error: unknown; status: number }>,
): Promise<T> {
	const { data, error } = await promise;

	if (error) {
		const apiError = extractApiError(error);
		if (apiError) {
			throw apiError;
		}
		if (error instanceof Error) {
			throw error;
		}
		throw new Error(String(error));
	}

	if (data === null) {
		throw new Error("Unexpected null response from API");
	}

	return data;
}
