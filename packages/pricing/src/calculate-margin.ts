import { roundCurrency } from "./currency";

/**
 * Calculates the sale price from a supplier price and margin percent.
 *
 * sale_price is app-calculated, NOT stored in the database.
 * Negative margin percentages are floored at 0% to prevent negative pricing.
 *
 * @param supplierPrice - The supplier/cost price
 * @param marginPercent - The margin percent to apply (e.g., 15 means 15%)
 * @returns The calculated sale price rounded to 2 decimal places
 */
export function calculateSalePrice(supplierPrice: number, marginPercent: number): number {
	const raw = Math.max(0, supplierPrice * (1 + Math.max(0, marginPercent) / 100));
	return roundCurrency(raw);
}
