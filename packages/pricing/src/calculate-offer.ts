import type { Role } from "./calculate-effective-price";
import { roundCurrency } from "./currency";
import { MAX_OFFER_DISCOUNT_PERCENT } from "./margins";

/**
 * Input type representing a single resolved offer applicable to a product.
 * Per-product overrides should be resolved by the caller before passing
 * these values to this function.
 */
export type OfferInput = {
	id?: string;
	discountType: "percentage" | "fixed_amount";
	discountValue: number;
};

/**
 * Result of applying offers to a single product.
 */
export type OfferResult = {
	/** Final price after all offer discounts */
	discountedPrice: number;
	/** Total discount amount applied */
	totalDiscount: number;
};

/**
 * Applies a list of offers to a single product's sale price.
 * Multiple offers stack, capped at MAX_OFFER_DISCOUNT_PERCENT of the sale price.
 *
 * ROLE CONTRACT (hardened):
 *   - `customer`    → Offers ARE applied. `discountedPrice` ≤ `salePrice`,
 *                     `totalDiscount` ≥ 0. The cart/order displays the offer price.
 *   - `distributor` → Offers are IGNORED. Returns `{ discountedPrice: salePrice, totalDiscount: 0 }`.
 *                     Distributor discount is structural (role margin), not promotional.
 *   - `admin`       → Offers are IGNORED. Returns `{ discountedPrice: salePrice, totalDiscount: 0 }`.
 *                     Admin sees raw price (no margin, no offer).
 *
 * For non-customer roles the product is returned unchanged regardless of
 * what `offers` contains: `discountedPrice === product.basePrice` and
 * `appliedOffers === []` at the caller level.
 *
 * @param salePrice - The product's base sale price (role-aware margin already applied)
 * @param offers - Array of resolved offers to apply (ignored for non-customer)
 * @param role - The user's role. If not 'customer', offers are always skipped.
 * @returns The discounted price and total discount amount
 */
export function applyOfferToProduct(
	salePrice: number,
	offers: OfferInput[],
	role: Role = "customer",
): OfferResult {
	// Business rule: offers only apply to customers
	if (role !== "customer") {
		return { discountedPrice: Math.max(0, salePrice), totalDiscount: 0 };
	}

	if (salePrice <= 0 || offers.length === 0) {
		return { discountedPrice: Math.max(0, salePrice), totalDiscount: 0 };
	}

	const totalRawDiscount = offers.reduce<number>((sum, offer) => {
		const effectiveValue = Math.max(0, offer.discountValue);
		const discount =
			offer.discountType === "percentage" ? salePrice * (effectiveValue / 100) : effectiveValue;

		return sum + discount;
	}, 0);

	const cap = salePrice * (MAX_OFFER_DISCOUNT_PERCENT / 100);
	const cappedDiscount = roundCurrency(Math.min(totalRawDiscount, cap));
	const discountedPrice = roundCurrency(Math.max(0, salePrice - cappedDiscount));

	return { discountedPrice, totalDiscount: cappedDiscount };
}
