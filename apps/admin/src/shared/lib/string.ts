export function toApiValue(value: string): string | undefined {
	const trimmed = value.trim();
	return trimmed === "" ? undefined : trimmed;
}
