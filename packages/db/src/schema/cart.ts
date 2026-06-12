import {
	index,
	integer,
	numeric,
	pgEnum,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { lifecycleDates, primaryKey } from "./_utils";
import { users } from "./auth";
import { products } from "./products";

// ── Enums ────────────────────────────────────────────

export const cartItemStatusEnum = pgEnum("cart_item_status", [
	"available",
	"out_of_stock",
	"price_changed",
	"unavailable",
]);

// ── Carts ────────────────────────────────────────────

export const carts = pgTable(
	"carts",
	{
		...primaryKey,

		userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
		guestToken: varchar("guest_token", { length: 64 }),

		itemsCount: integer("items_count").default(0).notNull(),
		lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),

		...lifecycleDates,
	},
	(table) => [
		index("carts_user_id_idx").on(table.userId),
		index("carts_guest_token_idx").on(table.guestToken),
		index("carts_last_activity_idx").on(table.lastActivityAt),
		uniqueIndex("carts_user_id_unique").on(table.userId),
		uniqueIndex("carts_guest_token_unique").on(table.guestToken),
	],
);

// ── Cart Items ────────────────────────────────────────

export const cartItems = pgTable(
	"cart_items",
	{
		...primaryKey,

		cartId: uuid("cart_id")
			.notNull()
			.references(() => carts.id, { onDelete: "cascade" }),
		productId: uuid("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),

		quantity: integer("quantity").default(1).notNull(),
		addedAtPrice: numeric("added_at_price", { precision: 12, scale: 2 }).notNull(),
		status: cartItemStatusEnum("status").default("available").notNull(),
		statusMessage: text("status_message"),

		...lifecycleDates,
	},
	(table) => [
		index("cart_items_cart_id_idx").on(table.cartId),
		index("cart_items_product_id_idx").on(table.productId),
		index("cart_items_status_idx").on(table.status),
		unique("cart_items_cart_product_unique").on(table.cartId, table.productId),
	],
);
