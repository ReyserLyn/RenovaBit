/** Retorna un nuevo Date (ahora). */
import { TZDate } from "@date-fns/tz";
export function now(): Date {
	return new Date();
}

/** Formatea una fecha a ISO string. */
export function formatDate(date: Date): string {
	return date.toISOString();
}

/** Formatea una fecha en zona horaria de Lima. */
export function formatInLimaTz(date: Date): string {
	return new Intl.DateTimeFormat("es-PE", {
		timeZone: "America/Lima",
		dateStyle: "short",
		timeStyle: "short",
		hour12: false,
	}).format(date);
}

const PERU_DATE_STR_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isPeruDateStr(s: string): boolean {
	return PERU_DATE_STR_RE.test(s);
}

/**
 * Parses a YYYY-MM-DD string as start-of-day in Peru time → UTC Date.
 * Example: `peruDateToUtcStart("2026-06-18")` → `2026-06-18T05:00:00.000Z`
 * Returns `null` if the string is not a valid YYYY-MM-DD.
 */
export function peruDateToUtcStart(dateStr: string): Date | null {
	if (!isPeruDateStr(dateStr)) return null;
	return new Date(new TZDate(`${dateStr}T00:00:00`, "America/Lima").getTime());
}

/**
 * Parses a YYYY-MM-DD string as end-of-day in Peru time → UTC Date.
 * Example: `peruDateToUtcEnd("2026-06-19")` → `2026-06-20T04:59:59.999Z`
 * Returns `null` if the string is not a valid YYYY-MM-DD.
 */
export function peruDateToUtcEnd(dateStr: string): Date | null {
	if (!isPeruDateStr(dateStr)) return null;
	return new Date(new TZDate(`${dateStr}T23:59:59.999`, "America/Lima").getTime());
}
