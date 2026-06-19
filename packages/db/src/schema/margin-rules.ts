import { index, integer, numeric, pgTable, varchar } from "drizzle-orm/pg-core";
import { lifecycleDates, primaryKey as primaryKeyCol } from "./_utils";

/**
 * Margin rules define pricing tiers by supplier-price range, with one
 * percentage per non-admin role.
 *
 *   - Admin: never has rules. They always see the raw supplierPrice.
 *   - Customer: gets `customerPct` when a rule matches the supplier price.
 *   - Distributor: gets `distributorPct` when a rule matches.
 *
 * A single row covers both roles for the same price range — the only
 * difference between roles is which column is read at evaluation time.
 *
 * Lookup semantics: [minPrice, maxPrice). `maxPrice = null` means +∞.
 * Order: rows are sorted by `sortOrder ASC, minPrice ASC` at evaluation
 * time; the first match wins.
 *
 * sale_price itself is NOT stored — it's app-calculated on read.
 */
export const marginRules = pgTable(
	"margin_rules",
	{
		...primaryKeyCol,

		name: varchar("name", { length: 100 }).notNull().unique(),
		minPrice: numeric("min_price", { precision: 10, scale: 2 }).notNull(),
		maxPrice: numeric("max_price", { precision: 10, scale: 2 }),
		customerPct: numeric("customer_pct", { precision: 5, scale: 2 }).notNull(),
		distributorPct: numeric("distributor_pct", { precision: 5, scale: 2 }).notNull(),
		sortOrder: integer("sort_order").notNull().default(0),

		...lifecycleDates,
	},
	(table) => [index("margin_rules_range_idx").on(table.minPrice, table.maxPrice)],
);
