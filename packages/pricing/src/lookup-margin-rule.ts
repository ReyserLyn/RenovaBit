/**
 * Pure function: finds the margin rule that applies to a given supplier price.
 *
 * Lookup follows [minPrice, maxPrice) semantics — min inclusive, max exclusive.
 * A rule with maxPrice === null is treated as +∞ (upper bound).
 *
 * The returned object carries the customer percentage for that tier.
 *
 * @param supplierPrice - The supplier/cost price to look up
 * @param marginRules - Array of margin rules (from DB query)
 * @returns The matching rule's customer percentage, or null
 */
export function lookupMarginRule(
	supplierPrice: number,
	marginRules: ReadonlyArray<{
		minPrice: string;
		maxPrice: string | null;
		customerPct: string;
	}>,
): { customerPct: string } | null {
	for (const rule of marginRules) {
		const min = Number(rule.minPrice);
		const max = rule.maxPrice === null ? Infinity : Number(rule.maxPrice);

		if (supplierPrice >= min && supplierPrice < max) {
			return { customerPct: rule.customerPct };
		}
	}

	return null;
}
