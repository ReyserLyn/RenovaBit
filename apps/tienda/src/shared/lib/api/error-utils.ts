import { ApiClientError } from "@renovabit/backend-client";

export function resolveErrorMessage(error: unknown): string {
	if (error instanceof ApiClientError) return error.message;
	if (error instanceof Error) return error.message;
	return "Error inesperado";
}
