/**
 * Local copy of the role enum. We don't import from `@renovabit/db` to avoid
 * a circular workspace dep — keep this list in sync with `packages/db/src/schema/roles.ts`.
 */
export type Role = "admin" | "customer" | "distributor";

import { calculateSalePrice } from "./calculate-margin";
import { lookupMarginRule } from "./lookup-margin-rule";
import { DEFAULT_MARGIN_PERCENT, MAX_CUSTOM_MARGIN_PERCENT } from "./margins";

/**
 * Role-specific margin rules (the `role_margin_rules` table).
 * If a rule has no entry for the user's role, we fall back to the customer rules.
 */
export type RoleMarginRule = {
	role: Exclude<Role, "admin">; // admin never has rules — it always sees raw
	minPrice: string;
	maxPrice: string | null;
	marginPercent: string;
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
 * Accepts finite, non-negative numeric strings. Rejects empty, non-numeric,
 * and negative values, replacing them with 0 / "no-supplier-price".
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
 *   5. DEFAULT_MARGIN_PERCENT (15%)
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

	// 1. Admin = raw
	if (role === "admin") {
		return { salePrice: supplierPrice, marginPercent: 0, source: "admin-raw" };
	}

	// 2. Per-product override for this role
	if (role === "customer" || role === "distributor") {
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
		// 5. No matching customer rule — hardcoded fallback
		return {
			salePrice: calculateSalePrice(supplierPrice, DEFAULT_MARGIN_PERCENT),
			marginPercent: DEFAULT_MARGIN_PERCENT,
			source: "default-fallback",
		};
	}

	// 5. No rules at all
	return {
		salePrice: calculateSalePrice(supplierPrice, DEFAULT_MARGIN_PERCENT),
		marginPercent: DEFAULT_MARGIN_PERCENT,
		source: "no-rules",
	};
}

/**
 * Finds the role-specific margin rule for a given (role, supplierPrice).
 */
function lookupRoleRule(
	role: Exclude<Role, "admin">,
	supplierPrice: number,
	roleRules: ReadonlyArray<RoleMarginRule>,
): RoleMarginRule | null {
	for (const rule of roleRules) {
		if (rule.role !== role) continue;
		const min = Number(rule.minPrice);
		const max = rule.maxPrice === null ? Infinity : Number(rule.maxPrice);
		if (supplierPrice >= min && supplierPrice < max) {
			return rule;
		}
	}
	return null;
}
