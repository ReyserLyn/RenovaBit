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
 * Multiple offers stack, capped at MAX_OFFER_DISCOUNT_PERCENT of the sale price.
 *
 * @param salePrice - The product's base sale price
 * @param offers - Array of offers to apply (all are percentage-based)
 * @returns The discounted price and total discount amount
 */
export function computeOfferPrice(salePrice: number, offers: OfferInput[]): OfferResult {
	if (salePrice <= 0 || offers.length === 0) {
		return { discountedPrice: Math.max(0, salePrice), totalDiscount: 0 };
	}

	const totalRawDiscount = offers.reduce<number>((sum, offer) => {
		const effectiveValue = Math.max(0, offer.discountValue);
		return sum + salePrice * (effectiveValue / 100);
	}, 0);

	const cap = salePrice * (MAX_OFFER_DISCOUNT_PERCENT / 100);
	const cappedDiscount = roundCurrency(Math.min(totalRawDiscount, cap));
	const discountedPrice = roundCurrency(Math.max(0, salePrice - cappedDiscount));

	return { discountedPrice, totalDiscount: cappedDiscount };
}

/**
 * Applies a list of offers to a single product's sale price, respecting user role.
 *
 * ROLE CONTRACT:
 *   - `admin`       → No offers applied. Returns `salePrice` unchanged.
 *   - `customer`    → Offers ARE applied. Returns computed offer price.
 *   - `distributor` → Returns the better (lower) of `salePrice` vs `offerPrice`.
 *                      The distributor only sees the offer if it beats their tier price.
 *   - default       → Defensive: returns `salePrice` unchanged.
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

	if (role === "customer") {
		return computeOfferPrice(salePrice, offers);
	}

	if (role === "distributor") {
		const offerResult = computeOfferPrice(salePrice, offers);
		if (offerResult.discountedPrice < salePrice) {
			return offerResult;
		}
		return { discountedPrice: Math.max(0, salePrice), totalDiscount: 0 };
	}

	// Defensive: unknown role — return price unchanged
	return { discountedPrice: Math.max(0, salePrice), totalDiscount: 0 };
}
