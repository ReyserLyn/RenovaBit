import { boolean, index, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { lifecycleDates, primaryKey, seoFields } from "./_utils";

export const brands = pgTable(
	"brands",
	{
		...primaryKey,

		name: varchar("name", { length: 255 }).notNull().unique(),
		slug: varchar("slug", { length: 255 }).notNull().unique(),
		description: text("description"),

		imageUrl: text("image_url"),

		isActive: boolean("is_active").default(true).notNull(),
		isFeatured: boolean("is_featured").default(false).notNull(),

		...seoFields,
		...lifecycleDates,
	},
	(table) => [
		index("brands_slug_idx").on(table.slug),
		index("brands_active_idx").on(table.isActive),
		index("brands_featured_idx").on(table.isFeatured),
	],
);
