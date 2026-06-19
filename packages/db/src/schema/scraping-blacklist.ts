import { index, pgTable, text, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { lifecycleDates, primaryKey } from "./_utils";
import { users } from "./auth";

/**
 * Lista negra de scraping.
 *
 * Bloquea provider IDs para que nunca se importen durante syncs.
 * Cuando un admin añade una entrada desde un producto existente,
 * se elimina el producto y se guarda su nombre aquí como referencia.
 */
export const scrapingBlacklist = pgTable(
	"scraping_blacklist",
	{
		...primaryKey,

		source: varchar("source", { length: 100 }).notNull(),
		externalId: varchar("external_id", { length: 255 }).notNull(),

		/** Nombre del producto eliminado (si la entrada vino de un producto existente) */
		productName: varchar("product_name", { length: 255 }),

		/** Motivo del bloqueo */
		reason: text("reason"),

		/** Admin que añadió la entrada */
		createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),

		...lifecycleDates,
	},
	(table) => [
		unique("scraping_blacklist_source_external_unique").on(table.source, table.externalId),
		index("scraping_blacklist_source_idx").on(table.source),
	],
);
