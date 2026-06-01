// ── Shared Date Formatters ────────────────────────────
// Centraliza todos los formateadores de fecha/timestamp
// para mantener consistencia visual en todo admin.

const dateTimePE = new Intl.DateTimeFormat("es-PE", {
	day: "2-digit",
	month: "short",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

const dateTimePEWithSeconds = new Intl.DateTimeFormat("es-PE", {
	day: "2-digit",
	month: "short",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
});

const timePE = new Intl.DateTimeFormat("es-PE", {
	hour: "2-digit",
	minute: "2-digit",
});

const shortDateTime = new Intl.DateTimeFormat("es", {
	dateStyle: "short",
	timeStyle: "short",
});

/** Formato: `dd MMM yyyy, HH:mm` (ej: "02 jun 2026, 14:30") */
export function formatDateTime(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "—";
	return dateTimePE.format(d);
}

/** Formato: `dd MMM yyyy, HH:mm:ss` (ej: "02 jun 2026, 14:30:05") */
export function formatDateTimeSeconds(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "—";
	return dateTimePEWithSeconds.format(d);
}

/** Formato: `HH:mm` (ej: "14:30") */
export function formatTime(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "—";
	return timePE.format(d);
}

/** Formato corto: `dd/MM/yy, HH:mm` */
export function formatShortDateTime(value: Date | string): string {
	const d = typeof value === "string" ? new Date(value) : value;
	if (Number.isNaN(d.getTime())) return "—";
	return shortDateTime.format(d);
}

/** Duración entre dos timestamps ISO (ej: "2m 30s", "1h 15m") */
export function formatDuration(start: string, end: string): string {
	const ms = new Date(end).getTime() - new Date(start).getTime();
	const seconds = Math.round(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
	return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
