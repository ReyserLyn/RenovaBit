import { index, integer, numeric, pgTable, varchar } from "drizzle-orm/pg-core";
import { lifecycleDates, primaryKey as primaryKeyCol } from "./_utils";

/**
 * Margin rules define pricing tiers based on supplier price ranges.
 *
 * A product's sale_price is calculated by:
 *   1. Per-product role override (roleCustomMargins)
 *   2. Tier lookup by supplier_price against these rules [min, max)
 *   3. Hardcoded DEFAULT_MARGIN_PERCENT (15%) as fallback
 *
 * sale_price itself is NOT stored — it's app-calculated on read.
 */
export const marginRules = pgTable(
	"margin_rules",
	{
		...primaryKeyCol,

		name: varchar("name", { length: 255 }).notNull().unique(),
		minPrice: numeric("min_price", { precision: 10, scale: 2 }).notNull(),
		maxPrice: numeric("max_price", { precision: 10, scale: 2 }),
		marginPercent: numeric("margin_percent", { precision: 5, scale: 2 }).notNull(),
		sortOrder: integer("sort_order").notNull().default(0),

		...lifecycleDates,
	},
	(table) => [index("margin_rules_range_idx").on(table.minPrice, table.maxPrice)],
);
