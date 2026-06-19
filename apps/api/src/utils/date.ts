/** Retorna un nuevo Date (ahora). */
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
