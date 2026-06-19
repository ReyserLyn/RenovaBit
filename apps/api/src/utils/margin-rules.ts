import { db } from "@renovabit/db";
import { marginRules, roleMarginRules } from "@renovabit/db/schema";
import { asc } from "drizzle-orm";

/**
 * Customer margin rules (the `margin_rules` table). Used for default pricing
 * and as a fallback for non-customer roles when no role-specific rule matches.
 */
export async function getActiveMarginRules() {
	return db
		.select({
			minPrice: marginRules.minPrice,
			maxPrice: marginRules.maxPrice,
			marginPercent: marginRules.marginPercent,
		})
		.from(marginRules)
		.orderBy(asc(marginRules.minPrice));
}

/**
 * Role-specific margin rules (the `role_margin_rules` table). Currently
 * `customer` and `distributor` are valid; `admin` never has rules (always raw).
 */
export async function getActiveRoleMarginRules() {
	return db
		.select({
			role: roleMarginRules.role,
			minPrice: roleMarginRules.minPrice,
			maxPrice: roleMarginRules.maxPrice,
			marginPercent: roleMarginRules.marginPercent,
		})
		.from(roleMarginRules)
		.orderBy(asc(roleMarginRules.minPrice));
}
