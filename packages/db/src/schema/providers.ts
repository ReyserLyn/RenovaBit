import {
	boolean,
	index,
	integer,
	numeric,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { lifecycleDates, primaryKey } from "./_utils";
import { products } from "./products";

/**
 * Mapea un producto canónico a su proveedor externo.
 * Soporta multi-provider: un producto puede venir de varias fuentes.
 */
export const productProviders = pgTable(
	"product_providers",
	{
		...primaryKey,

		productId: uuid("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),

		externalId: varchar("external_id", { length: 255 }).notNull(),
		source: varchar("source", { length: 100 }).notNull(),

		// Datos crudos del proveedor
		rawName: text("raw_name"),
		rawPrice: numeric("raw_price", { precision: 12, scale: 2 }),
		rawStock: integer("raw_stock").default(0),

		// Timestamps de sync
		lastSyncAt: timestamp("last_sync_at"),
		lastSeenAt: timestamp("last_seen_at"),

		// Flags
		isUnavailable: boolean("is_unavailable").default(false),
		needsReview: boolean("needs_review").default(false),
		reviewReason: text("review_reason"),

		rawImageUrl: text("raw_image_url"),
		rawImageHash: varchar("raw_image_hash", { length: 64 }),

		...lifecycleDates,
	},
	(table) => [
		unique("product_providers_external_unique").on(table.source, table.externalId),
		index("product_providers_product_idx").on(table.productId),
	],
);
