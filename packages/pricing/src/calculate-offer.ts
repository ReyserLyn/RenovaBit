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
 * Pure function that computes the offer price from a list of offers,
 * unconditionally (no role checking).
 *
 * Only the BEST offer applies — the largest discount percentage wins,
 * discounts never stack. This matches marketplace conventions and prevents
 * accidental deep discounts when campaigns overlap.
 *
 * @param salePrice - The product's base sale price
 * @param offers - Array of offers to apply (all are percentage-based)
 * @returns The discounted price and discount amount
 */
export function computeOfferPrice(salePrice: number, offers: OfferInput[]): OfferResult {
	if (salePrice <= 0 || offers.length === 0) {
		return { discountedPrice: Math.max(0, salePrice), totalDiscount: 0 };
	}

	const bestPercent = Math.min(
		MAX_OFFER_DISCOUNT_PERCENT,
		offers.reduce((best, offer) => Math.max(best, Math.max(0, offer.discountValue)), 0),
	);

	const discount = roundCurrency(salePrice * (bestPercent / 100));
	const discountedPrice = roundCurrency(Math.max(0, salePrice - discount));

	return { discountedPrice, totalDiscount: discount };
}

/**
 * Applies a list of offers to a single product's sale price, respecting user role.
 *
 * ROLE CONTRACT:
 *   - `admin`    → No offers applied. Returns `salePrice` unchanged.
 *   - `customer` → Offers ARE applied. Returns the computed offer price.
 *
 * @param salePrice - The product's base sale price (role-aware margin already applied)
 * @param offers - Array of resolved offers to apply
 * @param role - The user's role
 * @returns The discounted price and total discount amount
 */
export function applyOfferToProduct(
	salePrice: number,
	offers: OfferInput[],
	role: Role = "customer",
): OfferResult {
	if (role === "admin") {
		return { discountedPrice: Math.max(0, salePrice), totalDiscount: 0 };
	}

	return computeOfferPrice(salePrice, offers);
}
