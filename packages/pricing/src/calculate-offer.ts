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
 * @param salePrice - The product's base sale price
 * @param offers - Array of resolved offers to apply
 * @returns The discounted price and total discount amount
 */
export function applyOfferToProduct(salePrice: number, offers: OfferInput[]): OfferResult {
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
	const cappedDiscount = Math.min(totalRawDiscount, cap);
	const discountedPrice = Math.max(0, salePrice - cappedDiscount);

	return { discountedPrice, totalDiscount: cappedDiscount };
}
