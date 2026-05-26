import { boolean, index, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { lifecycleDates, primaryKey, seoFields } from "./_utils";
import { users } from "./auth";

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

		createdBy: uuid("created_by").references(() => users.id),
		updatedBy: uuid("updated_by").references(() => users.id),

		...seoFields,
		...lifecycleDates,
	},
	(table) => [
		index("brands_slug_idx").on(table.slug),
		index("brands_active_idx").on(table.isActive),
		index("brands_featured_idx").on(table.isFeatured),
	],
);
