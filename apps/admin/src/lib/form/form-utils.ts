export type FieldErrorItem = { message?: string } | undefined;

export function normalizeFieldErrors(errors: unknown[]): FieldErrorItem[] {
	return errors.map((error) => {
		if (typeof error === "string") {
			return { message: error };
		}
		if (
			typeof error === "object" &&
			error !== null &&
			"message" in error &&
			typeof error.message === "string"
		) {
			return { message: error.message };
		}
		return undefined;
	});
}

export function getFieldErrorId(formId: string, fieldName: string): string {
	return `${formId}-${fieldName}-error`;
}
