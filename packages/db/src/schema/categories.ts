import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { boolean, index, integer, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { lifecycleDates, primaryKey, seoFields } from "./_utils";

export const categories = pgTable(
	"categories",
	{
		...primaryKey,

		name: varchar("name", { length: 255 }).notNull().unique(),
		slug: varchar("slug", { length: 255 }).notNull().unique(),
		description: text("description"),

		imageUrl: text("image_url"),

		parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
			onDelete: "set null",
		}),
		path: text("path"),
		sortOrder: integer("sort_order").default(0),

		isFeatured: boolean("is_featured").default(false).notNull(),
		isActive: boolean("is_active").default(true).notNull(),
		isVisibleInNav: boolean("is_visible_in_nav").default(true).notNull(),

		...seoFields,
		...lifecycleDates,
	},
	(table) => [
		index("categories_slug_idx").on(table.slug),
		index("categories_parent_id_idx").on(table.parentId),
		index("categories_active_idx").on(table.isActive),
		index("categories_sort_order_idx").on(table.sortOrder),
		index("categories_name_idx").on(table.name),
	],
);
