import { index, integer, numeric, pgEnum, pgTable } from "drizzle-orm/pg-core";
import { lifecycleDates, primaryKey as primaryKeyCol } from "./_utils";

/**
 * Role-specific margin rules. Layered on top of `margin_rules` (the customer
 * default). Resolution priority is in `packages/pricing/src/calculate-effective-price.ts`.
 *
 * Admin role is never stored here — admins see the raw supplierPrice (no margin).
 * Customer can be stored here too (rare, but supported for explicit overrides).
 */
export const roleMarginRuleRoleEnum = pgEnum("role_margin_rule_role", ["customer", "distributor"]);

export const roleMarginRules = pgTable(
	"role_margin_rules",
	{
		...primaryKeyCol,

		role: roleMarginRuleRoleEnum("role").notNull(),
		minPrice: numeric("min_price", { precision: 10, scale: 2 }).notNull(),
		maxPrice: numeric("max_price", { precision: 10, scale: 2 }),
		marginPercent: numeric("margin_percent", { precision: 5, scale: 2 }).notNull(),
		sortOrder: integer("sort_order").notNull().default(0),

		...lifecycleDates,
	},
	(table) => [
		index("role_margin_rules_role_range_idx").on(table.role, table.minPrice, table.maxPrice),
	],
);
