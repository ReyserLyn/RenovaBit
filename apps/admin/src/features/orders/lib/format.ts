const currencyFormatter = new Intl.NumberFormat("es-PE", {
	style: "currency",
	currency: "PEN",
	minimumFractionDigits: 2,
});

const shortDateTimeFormatter = new Intl.DateTimeFormat("es", {
	dateStyle: "short",
	timeStyle: "short",
});

const fullDateTimeFormatter = new Intl.DateTimeFormat("es", {
	dateStyle: "long",
	timeStyle: "short",
});

export function formatCurrency(value: string): string {
	const num = Number.parseFloat(value);
	if (Number.isNaN(num)) return "S/ 0.00";
	return currencyFormatter.format(num);
}

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
