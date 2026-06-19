/**
 * Pricing constants — single source of truth.
 */

/**
 * Default margin percent for the customer role.
 *
 * Used as the last-resort fallback in `getEffectiveSalePrice` when there
 * are no tier rules configured. The admin should configure explicit tier
 * rules (`/admin/margin-rules`) so this constant is only a safety net
 * for an empty DB.
 */
export const DEFAULT_MARGIN_PERCENT = 20;

/**
 * Default margin percent for the distributor role.
 * Same fallback semantics as `DEFAULT_MARGIN_PERCENT`.
 */
export const DEFAULT_DISTRIBUTOR_MARGIN_PERCENT = 10;

/** Maximum sanity bound for tier-based margin percent. */
export const MAX_MARGIN_PERCENT = 100;

/**
 * Maximum sanity bound for per-product override margin percent.
 *
 * Business rationale: premium/luxury products can require very high markups
 * (e.g., specialized industrial equipment, exclusive brands). The 1000% cap
 * (i.e., 10× cost) is deliberately generous to accommodate real distributor
 * catalogs where niche items carry extreme margins. This is not a default —
 * it's a safety ceiling enforced on per-product overrides only. Tier-based
 * margin rules use MAX_MARGIN_PERCENT (100 %) instead.
 */
export const MAX_CUSTOM_MARGIN_PERCENT = 1000;

/** Maximum allowed discount from stacked offers, as percent of product sale_price. */
export const MAX_OFFER_DISCOUNT_PERCENT = 100;

/**
 * Valid source strings returned by `getEffectiveSalePrice`.
 * This tuple enables type-safe checking of resolution sources in calling code.
 */
export const ROLE_RESOLUTION_LABELS = [
	"admin-raw",
	"no-supplier-price",
	"per-product-override",
	"tier",
	"default-fallback",
] as const;

export type RoleResolutionSource = (typeof ROLE_RESOLUTION_LABELS)[number];
