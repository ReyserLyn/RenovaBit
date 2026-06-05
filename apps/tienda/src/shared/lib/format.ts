const currencyFormatter = new Intl.NumberFormat("es-PE", {
	style: "currency",
	currency: "PEN",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

/**
 * Formatea un precio en string (desde la DB) a formato de moneda peruana.
 * Ej: "1500.00" → "S/ 1,500.00"
 */
export function formatPrice(price: string): string {
	const num = Number.parseFloat(price);
	if (Number.isNaN(num)) return "S/ 0.00";
	return currencyFormatter.format(num);
}
