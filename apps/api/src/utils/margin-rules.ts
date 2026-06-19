import { db } from "@renovabit/db";
import { marginRules } from "@renovabit/db/schema";
import { asc } from "drizzle-orm";

/**
 * Active margin rules used by the pricing lib.
 *
 * One row covers both non-admin roles: `customerPct` is read for the
 * `customer` role, `distributorPct` for the `distributor` role.
 * Admin never matches a rule (they always see the raw supplierPrice).
 *
 * Ordered by `sortOrder ASC` first (lower = higher priority), then
 * `minPrice ASC` as a stable tiebreaker. The first row whose range
 * contains the supplier price wins.
 */
export async function getActiveMarginRules() {
	return db
		.select({
			minPrice: marginRules.minPrice,
			maxPrice: marginRules.maxPrice,
			customerPct: marginRules.customerPct,
			distributorPct: marginRules.distributorPct,
			sortOrder: marginRules.sortOrder,
		})
		.from(marginRules)
		.orderBy(asc(marginRules.sortOrder), asc(marginRules.minPrice));
}
