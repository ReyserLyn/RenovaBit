import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	numeric,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { lifecycleDates, primaryKey as primaryKeyCol } from "./_utils";
import { users } from "./auth";
import { products } from "./products";

// ── Offers ────────────────────────────────────────────

export const offers = pgTable(
	"offers",
	{
		...primaryKeyCol,

		name: varchar("name", { length: 100 }).notNull(),
		slug: varchar("slug", { length: 100 }).notNull().unique(),
		description: text("description"),

		/**
		 * Discount value as a percentage (0–100).
		 * Only percentage-based discounts are supported; fixed amounts were removed.
		 */
		discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull().default("0"),

		startsAt: timestamp("starts_at").notNull(),
		endsAt: timestamp("ends_at").notNull(),

		isActive: boolean("is_active").default(true),
		isFeatured: boolean("is_featured").default(false),

		createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),

		...lifecycleDates,
	},
	(table) => [
		index("offers_slug_idx").on(table.slug),
		index("offers_active_dates_idx").on(table.isActive, table.startsAt, table.endsAt),
		index("offers_is_featured_idx").on(table.isFeatured),
		check(
			"discount_value_range",
			sql`${table.discountValue} >= 0 AND ${table.discountValue} <= 100`,
		),
	],
);

// ── Offer-Product Junction ────────────────────────────

export const offerProducts = pgTable(
	"offer_products",
	{
		offerId: uuid("offer_id")
			.notNull()
			.references(() => offers.id, { onDelete: "cascade" }),
		productId: uuid("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),

		overrideDiscountValue: numeric("override_discount_value", {
			precision: 10,
			scale: 2,
		}),

		...lifecycleDates,
	},
	(table) => [
		primaryKey({ columns: [table.offerId, table.productId] }),
		index("offer_products_offer_idx").on(table.offerId),
		index("offer_products_product_idx").on(table.productId),
	],
);
