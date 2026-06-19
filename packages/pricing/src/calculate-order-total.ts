import { applyOfferToProduct, type OfferInput } from "./calculate-offer";

/**
 * Input representing an item in the cart for order total calculation.
 *
 * The `salePrice` MUST be pre-calculated by the caller using
 * `getEffectiveSalePrice(product, role, customerRules, roleRules)`.
 * This orchestrator does NOT fetch margin rules — it receives the resolved salePrice.
 */
export type CartItemInput = {
	salePrice: number;
	quantity: number;
	offers?: OfferInput[];
};

/**
 * Input for the full order total calculation.
 */
export type OrderTotalInput = {
	items: CartItemInput[];
};

/**
 * Complete order total breakdown.
 */
export type OrderTotalResult = {
	/** Sum of all item sale_price × quantity before offers */
	subtotal: number;
	/** Total discount from offer stacking */
	offerDiscount: number;
	/** Final total after offers (floored at 0) */
	total: number;
};

/**
 * Calculates the full order total by applying offers.
 * Calculation order: sale_price (margin applied) → offers.
 *
 * This is a PURE function — no DB access, no HTTP.
 *
 * DATA FLOW for the caller:
 *   1. Caller queries marginRules from DB (active rules)
 *   2. For each product, call `calculateMarginPercent(product, marginRules)`
 *      to get the effective margin %
 *   3. Call `calculateSalePrice(supplierPrice, marginPercent)` to get salePrice
 *   4. Build CartItemInput[] with the resolved salePrices
 *   5. Call this function
 *
 * @param input - Cart items with pre-calculated salePrices
 * @returns Complete pricing breakdown
 */
export function calculateOrderTotal(input: OrderTotalInput): OrderTotalResult {
	const { items } = input;

	// Step 1: Calculate subtotal (sum of sale_price × quantity)
	const subtotal = items.reduce<number>((sum, item) => {
		return sum + item.salePrice * item.quantity;
	}, 0);

	// Step 2: Resolve offers per item
	let offerDiscount = 0;

	for (const item of items) {
		if (item.offers && item.offers.length > 0) {
			const result = applyOfferToProduct(item.salePrice, item.offers);
			const originalLine = item.salePrice * item.quantity;
			const discountedLine = result.discountedPrice * item.quantity;
			offerDiscount += originalLine - discountedLine;
		}
	}

	// Step 3: Calculate final total (floored at 0)
	const total = Math.max(0, subtotal - offerDiscount);

	return {
		subtotal,
		offerDiscount,
		total,
	};
}
