// ── Offer calculation ──────────────────────────────────

export {
	getEffectiveSalePrice,
	type MarginRule,
	type Role,
	validateSupplierPrice,
} from "./calculate-effective-price";
// ── Margin calculation ─────────────────────────────────
export { calculateSalePrice } from "./calculate-margin";
export type { OfferInput, OfferResult } from "./calculate-offer";
export { applyOfferToProduct } from "./calculate-offer";
export type { CartItemInput, OrderTotalInput, OrderTotalResult } from "./calculate-order-total";
// ── Order total ────────────────────────────────────────
export { calculateOrderTotal } from "./calculate-order-total";
// ── Currency ───────────────────────────────────────────
export { roundCurrency } from "./currency";
export { lookupMarginRule } from "./lookup-margin-rule";
export type { RoleResolutionSource } from "./margins";
// ── Constants ──────────────────────────────────────────
export {
	DEFAULT_DISTRIBUTOR_MARGIN_PERCENT,
	DEFAULT_MARGIN_PERCENT,
	MAX_CUSTOM_MARGIN_PERCENT,
	MAX_MARGIN_PERCENT,
	MAX_OFFER_DISCOUNT_PERCENT,
} from "./margins";
