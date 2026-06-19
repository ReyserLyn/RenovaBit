import type { Role } from "@renovabit/db/schema";

// Re-export Role so @renovabit/pricing consumers can use it without depending on @renovabit/db directly.
export type { Role };

import { calculateSalePrice } from "./calculate-margin";
import { roundCurrency } from "./currency";
import { lookupMarginRule } from "./lookup-margin-rule";
import {
	DEFAULT_DISTRIBUTOR_MARGIN_PERCENT,
	DEFAULT_MARGIN_PERCENT,
	MAX_CUSTOM_MARGIN_PERCENT,
} from "./margins";

/**
 * Role-specific margin rules (the `role_margin_rules` table).
 * If a rule has no entry for the user's role, we fall back to the customer rules.
 */
export type RoleMarginRule = {
	role: Exclude<Role, "admin">; // admin never has rules — it always sees raw
	minPrice: string;
	maxPrice: string | null;
	marginPercent: string;
	sortOrder?: number; // Resolution priority (lower = higher priority). Falls back to 0.
};

/**
 * Per-product override (the `products.roleCustomMargins` JSONB column).
 * `enabled: true` means "use this percent regardless of tier rules".
 */
export type ProductRoleCustomMargins = {
	customer?: { enabled: true; percent: string };
	distributor?: { enabled: true; percent: string };
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
 *   3. roleMarginRules lookup for (role, supplierPrice) — non-customer only
 *   4. customerRules lookup (fallback when role-rules miss) — non-customer only
 *   5. DEFAULT_MARGIN_PERCENT (15%) for customer, DEFAULT_DISTRIBUTOR_MARGIN_PERCENT (10%) for distributor
 *
 * Admin never gets a margin applied — they see the raw cost.
 */
export function getEffectiveSalePrice(
	product: {
		supplierPrice: string;
		roleCustomMargins?: ProductRoleCustomMargins | null;
	},
	role: Role,
	customerRules: ReadonlyArray<{
		minPrice: string;
		maxPrice: string | null;
		marginPercent: string;
	}>,
	roleRules: ReadonlyArray<RoleMarginRule> = [],
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
	const custom = product.roleCustomMargins?.[role as "customer" | "distributor"];
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

	// 3. Role-specific tier rule (only for non-customer; customer uses customerRules directly)
	if (role === "distributor") {
		const roleRule = lookupRoleRule("distributor", supplierPrice, roleRules);
		if (roleRule !== null) {
			const pct = Number(roleRule.marginPercent);
			return {
				salePrice: calculateSalePrice(supplierPrice, pct),
				marginPercent: pct,
				source: "role-tier",
			};
		}
	}

	// 4. Customer tier rule (also serves as fallback for non-customer roles)
	const fallbackPercent =
		role === "distributor" ? DEFAULT_DISTRIBUTOR_MARGIN_PERCENT : DEFAULT_MARGIN_PERCENT;

	if (customerRules.length > 0) {
		const rule = lookupMarginRule(supplierPrice, customerRules);
		if (rule !== null) {
			const pct = Number(rule.marginPercent);
			return {
				salePrice: calculateSalePrice(supplierPrice, pct),
				marginPercent: pct,
				source: "customer-tier",
			};
		}
	}

	// 5. Hardcoded fallback — no rule matched the supplier price (or no rules at all).
	//    Both paths converge to the same logic and same source label because the
	//    distinction (empty rules vs. unmatched price) is not meaningful to callers.
	return {
		salePrice: calculateSalePrice(supplierPrice, fallbackPercent),
		marginPercent: fallbackPercent,
		source: "default-fallback",
	};
}

/**
 * Finds the role-specific margin rule for a given (role, supplierPrice).
 *
 * Resolution policy:
 *   1. Filter rules by role
 *   2. Sort by sortOrder ASC (lower = higher priority), then minPrice ASC as tiebreaker
 *   3. Return the first matching rule by price range [minPrice, maxPrice)
 *   4. If no rule matches the price range, return null
 *
 * This means sortOrder controls priority, NOT the order of rules in the array.
 * Two rules with overlapping price ranges are allowed only if they have different
 * sortOrder values (the lower sortOrder wins). The DB-level UNIQUE(role, name) +
 * service-layer overlap check prevent ambiguous overlaps at the same sortOrder.
 */
function lookupRoleRule(
	role: Exclude<Role, "admin">,
	supplierPrice: number,
	roleRules: ReadonlyArray<RoleMarginRule>,
): RoleMarginRule | null {
	const applicable = roleRules
		.filter((rule) => rule.role === role)
		.sort((a, b) => {
			const sortA = a.sortOrder ?? 0;
			const sortB = b.sortOrder ?? 0;
			if (sortA !== sortB) return sortA - sortB;
			return Number(a.minPrice) - Number(b.minPrice);
		});

	for (const rule of applicable) {
		const min = Number(rule.minPrice);
		const max = rule.maxPrice === null ? Infinity : Number(rule.maxPrice);
		if (supplierPrice >= min && supplierPrice < max) {
			return rule;
		}
	}
	return null;
}
