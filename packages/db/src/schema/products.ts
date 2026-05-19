import {
	boolean,
	index,
	integer,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	text,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { lifecycleDates, primaryKey, seoFields } from "./_utils";
import { brands } from "./brands";
import { categories } from "./categories";

export type ProductSpecification = {
	id: string;
	key: string;
	value: string;
};

export const productStatusEnum = pgEnum("product_status", ["active", "inactive", "out_of_stock"]);

export const products = pgTable(
	"products",
	{
		...primaryKey,

		name: varchar("name", { length: 255 }).notNull().unique(),
		slug: varchar("slug", { length: 255 }).notNull().unique(),
		description: text("description"),

		sku: varchar("sku", { length: 100 }).notNull().unique(),
		price: numeric("price", { precision: 12, scale: 2 }).notNull(),
		stock: integer("stock").default(0).notNull(),

		brandId: uuid("brand_id").references(() => brands.id, {
			onDelete: "set null",
		}),
		categoryId: uuid("category_id").references(() => categories.id, {
			onDelete: "set null",
		}),

		specifications: jsonb("specifications").$type<ProductSpecification[]>().default([]),
		status: productStatusEnum("status").default("active").notNull(),
		isFeatured: boolean("is_featured").default(false).notNull(),

		...seoFields,
		...lifecycleDates,
	},
	(table) => [
		index("products_slug_idx").on(table.slug),
		index("products_sku_idx").on(table.sku),
		index("products_brand_id_idx").on(table.brandId),
		index("products_category_id_idx").on(table.categoryId),
		index("products_status_idx").on(table.status),
		index("products_featured_idx").on(table.isFeatured),
	],
);

export const productImages = pgTable(
	"product_images",
	{
		...primaryKey,

		productId: uuid("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),
		url: text("url").notNull(),
		alt: varchar("alt", { length: 255 }),

		sortOrder: integer("sort_order").default(0),
		isPrimary: boolean("is_primary").default(false).notNull(),

		...lifecycleDates,
	},
	(table) => [
		index("product_images_product_id_idx").on(table.productId),
		index("product_images_sort_order_idx").on(table.sortOrder),
		index("product_images_primary_idx").on(table.isPrimary),
	],
);
