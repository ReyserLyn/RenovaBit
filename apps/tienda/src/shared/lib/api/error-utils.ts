import { ApiClientError } from "@renovabit/backend-client";

/**
 * Errors the API uses to signal that the current session is no longer valid
 * or does not own the requested resource. `ACCESS_DENIED` also covers cart
 * ownership mismatches, which for an expired session is the same user-facing
 * outcome: sign in again.
 */
export function isAuthError(error: unknown): boolean {
	return (
		error instanceof ApiClientError &&
		(error.statusCode === 401 ||
			error.code === "ACCESS_DENIED" ||
			error.code === "INVALID_CREDENTIALS")
	);
}

/**
 * Known API errors carry user-facing Spanish messages from the backend and are
 * safe to surface. Anything else (network failures, unexpected null payloads,
 * third-party errors) may leak technical text, so it collapses to a generic
 * message.
 */
export function resolveErrorMessage(error: unknown): string {
	if (error instanceof ApiClientError) return error.message;
	return "Ocurrió un error inesperado. Inténtalo de nuevo.";
}
