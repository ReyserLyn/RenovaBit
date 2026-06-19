import { lookupMarginRule } from "./lookup-margin-rule";
import { DEFAULT_MARGIN_PERCENT } from "./margins";

/**
 * Looks up the customer-tier margin for a given supplier price.
 * Returns the hardcoded fallback (`DEFAULT_MARGIN_PERCENT`) if no rule matches.
 *
 * Per-product overrides are expressed via `roleCustomMargins` and handled by
 * `getEffectiveSalePrice`.
 */
export function getCustomerTierMargin(
	supplierPrice: string,
	marginRules: ReadonlyArray<{
		minPrice: string;
		maxPrice: string | null;
		marginPercent: string;
	}>,
): number {
	const rule = lookupMarginRule(Number(supplierPrice), marginRules);
	if (rule !== null) {
		return Number(rule.marginPercent);
	}
	return DEFAULT_MARGIN_PERCENT;
}

/**
 * Calculates the sale price from a supplier price and margin percent.
 *
 * sale_price is app-calculated, NOT stored in the database.
 *
 * @param supplierPrice - The supplier/cost price
 * @param marginPercent - The margin percent to apply (e.g., 15 means 15%)
 * @returns The calculated sale price rounded to 2 decimal places
 */
export function calculateSalePrice(supplierPrice: number, marginPercent: number): number {
	const raw = supplierPrice * (1 + marginPercent / 100);
	return Math.round(raw * 100) / 100;
}
