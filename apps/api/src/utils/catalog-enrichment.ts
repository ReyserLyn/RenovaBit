import type { RoleCustomMargins } from "@renovabit/db/schema";
import {
	applyOfferToProduct,
	type MarginRule,
	type OfferInput,
	type Role,
} from "@renovabit/pricing";
import { resolveSalePrice } from "@/utils/price";

/**
 * Minimal offer shape attached to a catalog row (see
 * `activeOffersForProductSubquery` in offers/service.ts). Kept structural so
 * this util does not depend on the offers module.
 */
type CatalogOffer = {
	id: string;
	discountValue: string;
};

/**
 * Fields a catalog row must expose for pricing. Both `listPublic` and `search`
 * select this exact shape.
 */
type EnrichableProductRow = {
	supplierPrice: string;
	roleCustomMargins: RoleCustomMargins | null;
	managedBy?: "provider" | "manual" | null;
	price?: string | null;
	offers: CatalogOffer[];
};

export type CatalogPricing = {
	/** Base sale price before offers (role-aware margins, or stored price for manual). */
	salePrice: number;
	/** `salePrice` formatted with 2 decimals — the public `price` field. */
	basePriceStr: string;
	/** Best-offer price formatted, or null when no offer applies (incl. admin). */
	offerPriceStr: string | null;
	/** Offer discount as an integer percentage; 0 when no offer applies. */
	discountPercent: number;
	/** What the buyer pays: `offerPriceStr` when present, else `salePrice`. */
	effectivePrice: number;
	/** Id of the winning offer, or null when no offer produced a discount. */
	bestOfferId: string | null;
};

/**
 * Single definition of the public catalog pricing math: base price + best
 * offer (no stacking) → displayed `price` / `offerPrice` / `discountPercent`
 * plus the effective price used for filtering and sorting.
 *
 * Used by `listPublic`, `getBySlugPublic` and `search` so all three compute
 * the same numbers. The offers pricing engine lives in `@renovabit/pricing`;
 * this helper only adapts a catalog row to it.
 */
export function enrichPublicPricing({
	row,
	role,
	marginRules,
}: {
	row: EnrichableProductRow;
	role: Role;
	marginRules: ReadonlyArray<MarginRule>;
}): CatalogPricing {
	const salePrice = resolveSalePrice(row, role, marginRules);
	const basePriceStr = salePrice.toFixed(2);

	// Admin never sees offers; no offers attached → no discount to compute.
	if (role === "admin" || row.offers.length === 0) {
		return {
			salePrice,
			basePriceStr,
			offerPriceStr: null,
			discountPercent: 0,
			effectivePrice: salePrice,
			bestOfferId: null,
		};
	}

	const offerInputs: OfferInput[] = row.offers.map((offer) => ({
		id: offer.id,
		discountValue: Number.parseFloat(offer.discountValue) || 0,
	}));

	const result = applyOfferToProduct(salePrice, offerInputs, role);
	const discountPercent =
		salePrice > 0 ? Math.round(((salePrice - result.discountedPrice) / salePrice) * 100) : 0;
	const offerPriceStr =
		result.discountedPrice < salePrice ? result.discountedPrice.toFixed(2) : null;

	return {
		salePrice,
		basePriceStr,
		offerPriceStr,
		discountPercent,
		effectivePrice: offerPriceStr !== null ? Number.parseFloat(offerPriceStr) : salePrice,
		bestOfferId: offerPriceStr !== null ? result.bestOfferId : null,
	};
}
