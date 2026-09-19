const shortDateTimeFormatter = new Intl.DateTimeFormat("es", {
	dateStyle: "short",
	timeStyle: "short",
});

const fullDateTimeFormatter = new Intl.DateTimeFormat("es", {
	dateStyle: "long",
	timeStyle: "short",
});

export function formatShortDate(value: string): string {
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return "—";
	return shortDateTimeFormatter.format(d);
}

export function formatFullDate(value: string): string {
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return "—";
	return fullDateTimeFormatter.format(d);
}
