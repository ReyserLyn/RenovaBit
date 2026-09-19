import { boolean, index, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { lifecycleDates, primaryKey } from "./_utils";

// ── Enums ────────────────────────────────────────────
// "Libro de Reclamaciones" (Ley 29571, DS 011-2011-PCM):
// a "reclamo" disputes the product/service, a "queja" only shows malcontent.

export const COMPLAINT_TYPE_TUPLE = ["reclamo", "queja"] as const;
export const COMPLAINT_DOC_TYPE_TUPLE = ["DNI", "CE", "RUC", "PASAPORTE"] as const;
export const COMPLAINT_STATUS_TUPLE = ["pending", "in_review", "responded"] as const;

export type ComplaintType = (typeof COMPLAINT_TYPE_TUPLE)[number];
export type ComplaintDocType = (typeof COMPLAINT_DOC_TYPE_TUPLE)[number];
export type ComplaintStatus = (typeof COMPLAINT_STATUS_TUPLE)[number];

export const complaintTypeEnum = pgEnum("complaint_type", COMPLAINT_TYPE_TUPLE);

export const complaintDocTypeEnum = pgEnum("complaint_doc_type", COMPLAINT_DOC_TYPE_TUPLE);

export const complaintStatusEnum = pgEnum("complaint_status", COMPLAINT_STATUS_TUPLE);

// ── Complaints ────────────────────────────────────────

export const complaints = pgTable(
	"complaints",
	{
		...primaryKey,

		/** Public identifier shown to the consumer: `RB-XXXXXXXX` (8 uppercase alnum). */
		code: varchar("code", { length: 24 }).notNull().unique(),

		type: complaintTypeEnum("type").notNull(),

		fullName: varchar("full_name", { length: 255 }).notNull(),
		docType: complaintDocTypeEnum("doc_type").notNull(),
		docNumber: varchar("doc_number", { length: 20 }).notNull(),
		email: varchar("email", { length: 255 }).notNull(),
		phone: varchar("phone", { length: 20 }).notNull(),
		address: text("address").notNull(),

		/** Optional link to the order the complaint refers to. */
		orderNumber: varchar("order_number", { length: 50 }),

		/** Minors do not sign; the parent/guardian is recorded instead. */
		isMinor: boolean("is_minor").default(false).notNull(),
		guardianName: varchar("guardian_name", { length: 255 }),
		guardianDocNumber: varchar("guardian_doc_number", { length: 20 }),

		/** What happened (hechos) and what the consumer requests (pedido concreto). */
		description: text("description").notNull(),
		request: text("request").notNull(),

		status: complaintStatusEnum("status").default("pending").notNull(),
		responseText: text("response_text"),
		respondedAt: timestamp("responded_at"),

		...lifecycleDates,
	},
	(table) => [
		index("complaints_status_idx").on(table.status),
		index("complaints_doc_number_idx").on(table.docNumber),
		index("complaints_created_at_idx").on(table.createdAt),
		index("complaints_status_created_idx").on(table.status, table.createdAt),
	],
);
