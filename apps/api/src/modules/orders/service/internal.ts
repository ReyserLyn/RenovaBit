/**
 * Cross-cutting internals shared by the order service modules.
 */

export const AUTO_CANCEL_REASON = "Cancelado automáticamente por falta de confirmación";

export function parseJsonArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}
