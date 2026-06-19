const currencyFormatter = new Intl.NumberFormat("es-PE", {
	style: "currency",
	currency: "PEN",
	minimumFractionDigits: 2,
});

/**
 * Format a numeric string as PEN currency.
 * Returns "S/ 0.00" if the value cannot be parsed.
 */
export function formatCurrency(value: string): string {
	const num = Number.parseFloat(value);
	if (Number.isNaN(num)) return "S/ 0.00";
	return currencyFormatter.format(num);
}
