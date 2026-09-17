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
