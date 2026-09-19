import type { RoleCustomMargins } from "@renovabit/db/schema";
import { getEffectiveSalePrice, type MarginRule, type Role } from "@renovabit/pricing";

/**
 * Product fields needed to resolve its sale price.
 *
 * - `manual`: the stored `price` column IS the price — owner-controlled, no
 *   margins, never touched by the provider sync.
 * - anything else (`provider`): computed from supplierPrice + margin rules for
 *   the role, as always.
 */
type PriceableProduct = {
	managedBy?: "provider" | "manual" | null;
	price?: string | null;
	supplierPrice: string;
	roleCustomMargins?: RoleCustomMargins | null;
};

export function resolveSalePrice(
	product: PriceableProduct,
	role: Role,
	marginRules: ReadonlyArray<MarginRule>,
): number {
	if (product.managedBy === "manual") {
		const parsed = Number.parseFloat(product.price ?? "0");
		return Number.isFinite(parsed) ? parsed : 0;
	}

	return getEffectiveSalePrice(
		{
			supplierPrice: product.supplierPrice,
			roleCustomMargins: product.roleCustomMargins ?? null,
		},
		role,
		marginRules,
	).salePrice;
}

/**
 * Money equality for amounts that arrive from different sources.
 *
 * Postgres returns `numeric` columns with the declared scale ("90.00"), while
 * the feed and the pricing helpers produce scale-free strings ("90"). Comparing
 * the raw strings made the sync flag `supplier_price_changed` for every product
 * on every run — 969 "updates" that were only a formatting difference.
 */
export function sameMoneyAmount(a: string, b: string): boolean {
	const left = Number.parseFloat(a);
	const right = Number.parseFloat(b);
	if (!Number.isFinite(left) || !Number.isFinite(right)) return a === b;
	return left === right;
}
