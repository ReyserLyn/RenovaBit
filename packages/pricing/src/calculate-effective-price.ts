import type { Role, RoleCustomMargins } from "@renovabit/db/schema";

import { calculateSalePrice } from "./calculate-margin";
import { roundCurrency } from "./currency";
import { lookupMarginRule } from "./lookup-margin-rule";
import {
	DEFAULT_DISTRIBUTOR_MARGIN_PERCENT,
	DEFAULT_MARGIN_PERCENT,
	MAX_CUSTOM_MARGIN_PERCENT,
} from "./margins";

/**
 * `Role` is re-exported from `@renovabit/db/schema` so consumers of
 * `@renovabit/pricing` (admin UI, storefront, etc.) don't need to add
 * `@renovabit/db` as a direct dependency just to type a role string.
 * The value is stable (`"admin" | "customer" | "distributor"`) and comes
 * from one source of truth.
 */
export type { Role };

/**
 * A single margin rule row covers both non-admin roles. The pricing
 * lib reads `customerPct` for the `customer` role and `distributorPct`
 * for the `distributor` role from whichever rule matches the supplier
 * price. Admin never matches a rule.
 */
export type MarginRule = {
	minPrice: string;
	maxPrice: string | null;
	customerPct: string;
	distributorPct: string;
};

/**
 * Validates a supplier price string. Returns the parsed number or null if invalid.
 * Accepts finite, positive numeric strings. Rejects empty, non-numeric,
 * zero, and negative values, replacing them with 0 / "no-supplier-price".
 */
export function validateSupplierPrice(supplierPrice: string): { price: number } | null {
	const price = Number(supplierPrice);
	if (!Number.isFinite(price) || price <= 0) {
		return null;
	}
	return { price };
}

/**
 * Resolves the effective sale price for a product and a given user role.
 *
 * Resolution order:
 *   1. role === 'admin'              → raw supplierPrice, 0% margin
 *   2. product.roleCustomMargins[role] (per-product override)
 *   3. tier rule lookup (one row, both pcts) — read the role's column
 *   4. DEFAULT_MARGIN_PERCENT (20% customer, 10% distributor) as fallback
 *
 * Admin never gets a margin applied — they see the raw cost.
 *
 * The single `marginRules` array replaces the previous two-array design
 * (base + role-specific). The first rule whose [minPrice, maxPrice) range
 * contains the supplier price wins; we then read the column matching
 * the user's role from that row.
 */
export function getEffectiveSalePrice(
	product: {
		supplierPrice: string;
		roleCustomMargins?: RoleCustomMargins | null;
	},
	role: Role,
	marginRules: ReadonlyArray<MarginRule>,
): { salePrice: number; marginPercent: number; source: string } {
	const parsed = validateSupplierPrice(product.supplierPrice);
	if (parsed === null) {
		return { salePrice: 0, marginPercent: 0, source: "no-supplier-price" };
	}
	const supplierPrice = parsed.price;

	// 1. Admin = raw (rounded to 2dp for consistency)
	if (role === "admin") {
		return { salePrice: roundCurrency(supplierPrice), marginPercent: 0, source: "admin-raw" };
	}

	// 2. Per-product override for this role
	// Admin already returned early above, so role is always "customer" or "distributor" here.
	const custom = product.roleCustomMargins?.[role];
	if (custom?.enabled) {
		const pct = Number(custom.percent);
		if (Number.isFinite(pct) && pct >= 0 && pct <= MAX_CUSTOM_MARGIN_PERCENT) {
			return {
				salePrice: calculateSalePrice(supplierPrice, pct),
				marginPercent: pct,
				source: "per-product-override",
			};
		}
	}

	// 3. Tier rule — one row, pick the role's column
	const rule = lookupMarginRule(supplierPrice, marginRules);
	if (rule !== null) {
		const pct = Number(role === "distributor" ? rule.distributorPct : rule.customerPct);
		return {
			salePrice: calculateSalePrice(supplierPrice, pct),
			marginPercent: pct,
			source: "tier",
		};
	}

	// 4. Hardcoded fallback — no rule matched the supplier price (or no rules at all).
	const fallbackPercent =
		role === "distributor" ? DEFAULT_DISTRIBUTOR_MARGIN_PERCENT : DEFAULT_MARGIN_PERCENT;
	return {
		salePrice: calculateSalePrice(supplierPrice, fallbackPercent),
		marginPercent: fallbackPercent,
		source: "default-fallback",
	};
}
