import {
	boolean,
	index,
	numeric,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { lifecycleDates, primaryKey as primaryKeyCol } from "./_utils";
import { users } from "./auth";
import { brands } from "./brands";
import { categories } from "./categories";
import { discountTypeEnum } from "./discount-type";
import { products } from "./products";

export const OFFER_TYPES = ["product", "category", "brand"] as const;

export const offerTypeEnum = pgEnum("offer_type", OFFER_TYPES);

export type OfferType = (typeof OFFER_TYPES)[number];

// ── Offers ────────────────────────────────────────────

export const offers = pgTable(
	"offers",
	{
		...primaryKeyCol,

		name: varchar("name", { length: 100 }).notNull(),
		slug: varchar("slug", { length: 100 }).notNull().unique(),
		description: text("description"),

		type: offerTypeEnum("type").notNull().default("product"),
		discountType: discountTypeEnum("discount_type").notNull(),
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

		overrideDiscountType: discountTypeEnum("override_discount_type"),
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

// ── Offer-Brand Junction ─────────────────────────────

export const offerBrands = pgTable(
	"offer_brands",
	{
		offerId: uuid("offer_id")
			.notNull()
			.references(() => offers.id, { onDelete: "cascade" }),
		brandId: uuid("brand_id")
			.notNull()
			.references(() => brands.id, { onDelete: "cascade" }),

		overrideDiscountType: discountTypeEnum("override_discount_type"),
		overrideDiscountValue: numeric("override_discount_value", {
			precision: 10,
			scale: 2,
		}),

		...lifecycleDates,
	},
	(table) => [
		primaryKey({ columns: [table.offerId, table.brandId] }),
		index("offer_brands_offer_idx").on(table.offerId),
		index("offer_brands_brand_idx").on(table.brandId),
	],
);

// ── Offer-Category Junction ──────────────────────────

export const offerCategories = pgTable(
	"offer_categories",
	{
		offerId: uuid("offer_id")
			.notNull()
			.references(() => offers.id, { onDelete: "cascade" }),
		categoryId: uuid("category_id")
			.notNull()
			.references(() => categories.id, { onDelete: "cascade" }),

		overrideDiscountType: discountTypeEnum("override_discount_type"),
		overrideDiscountValue: numeric("override_discount_value", {
			precision: 10,
			scale: 2,
		}),

		...lifecycleDates,
	},
	(table) => [
		primaryKey({ columns: [table.offerId, table.categoryId] }),
		index("offer_categories_offer_idx").on(table.offerId),
		index("offer_categories_category_idx").on(table.categoryId),
	],
);
