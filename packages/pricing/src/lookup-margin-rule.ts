/**
 * Pure function: finds the margin rule that applies to a given supplier price.
 *
 * Lookup follows [minPrice, maxPrice) semantics — min inclusive, max exclusive.
 * A rule with maxPrice === null is treated as +∞ (upper bound).
 *
 * @param supplierPrice - The supplier/cost price to look up
 * @param marginRules - Array of margin rules (from DB query)
 * @returns The matching rule's marginPercent, or null if no rule matches
 */
export function lookupMarginRule(
	supplierPrice: number,
	marginRules: ReadonlyArray<{
		minPrice: string;
		maxPrice: string | null;
		marginPercent: string;
	}>,
): { marginPercent: string } | null {
	for (const rule of marginRules) {
		const min = Number(rule.minPrice);
		const max = rule.maxPrice === null ? Infinity : Number(rule.maxPrice);

		if (supplierPrice >= min && supplierPrice < max) {
			return { marginPercent: rule.marginPercent };
		}
	}

	return null;
}
