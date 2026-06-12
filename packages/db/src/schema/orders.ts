import {
	index,
	integer,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { lifecycleDates, primaryKey } from "./_utils";
import { users } from "./auth";
import { products } from "./products";

// ── Enums ────────────────────────────────────────────

export const orderStatusEnum = pgEnum("order_status", [
	"pending",
	"confirmed",
	"cancelled",
	"refunded",
]);

export const orderSourceEnum = pgEnum("order_source", ["web", "whatsapp"]);

export const paymentMethodEnum = pgEnum("payment_method", ["cash", "transfer", "yape", "plin"]);

// ── Orders ────────────────────────────────────────────

export const orders = pgTable(
	"orders",
	{
		...primaryKey,

		userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),

		orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),

		customerName: varchar("customer_name", { length: 255 }),
		customerPhone: varchar("customer_phone", { length: 20 }),

		status: orderStatusEnum("status").default("pending").notNull(),
		source: orderSourceEnum("source").default("web").notNull(),
		paymentMethod: paymentMethodEnum("payment_method"),
		paymentProofUrl: text("payment_proof_url"),

		subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default("0").notNull(),
		discountTotal: numeric("discount_total", { precision: 12, scale: 2 }).default("0").notNull(),
		total: numeric("total", { precision: 12, scale: 2 }).default("0").notNull(),

		notes: text("notes"),
		adminNotes: text("admin_notes"),

		metadata: jsonb("metadata").default({}),

		confirmedAt: timestamp("confirmed_at"),
		cancelledAt: timestamp("cancelled_at"),
		cancelReason: text("cancel_reason"),

		...lifecycleDates,
	},
	(table) => [
		index("orders_user_id_idx").on(table.userId),
		index("orders_status_idx").on(table.status),
		index("orders_order_number_idx").on(table.orderNumber),
		index("orders_created_at_idx").on(table.createdAt),
		index("orders_status_created_idx").on(table.status, table.createdAt),
	],
);

// ── Order Items ───────────────────────────────────────

export const orderItems = pgTable(
	"order_items",
	{
		...primaryKey,

		orderId: uuid("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "cascade" }),
		productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),

		productName: varchar("product_name", { length: 255 }).notNull(),
		productSku: varchar("product_sku", { length: 100 }).notNull(),

		quantity: integer("quantity").notNull(),
		unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
		finalPrice: numeric("final_price", { precision: 12, scale: 2 }).notNull(),

		...lifecycleDates,
	},
	(table) => [
		index("order_items_order_id_idx").on(table.orderId),
		index("order_items_product_id_idx").on(table.productId),
	],
);
