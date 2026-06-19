import { index, integer, pgTable, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { lifecycleDates, primaryKey } from "./_utils";
import { users } from "./auth";
import { products } from "./products";

// ── Favorites ───────────────────────────────────────

export const favorites = pgTable(
	"favorites",
	{
		...primaryKey,

		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		itemsCount: integer("items_count").default(0).notNull(),
		lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),

		...lifecycleDates,
	},
	(table) => [
		index("favorites_last_activity_idx").on(table.lastActivityAt),
		uniqueIndex("favorites_user_id_unique").on(table.userId),
	],
);

// ── Favorite Items ────────────────────────────────────

export const favoriteItems = pgTable(
	"favorite_items",
	{
		...primaryKey,

		favoriteId: uuid("favorite_id")
			.notNull()
			.references(() => favorites.id, { onDelete: "cascade" }),
		productId: uuid("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),

		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("favorite_items_favorite_id_idx").on(table.favoriteId),
		index("favorite_items_product_id_idx").on(table.productId),
		unique("favorite_items_fav_product_unique").on(table.favoriteId, table.productId),
	],
);
