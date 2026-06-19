import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { primaryKey } from "./_utils";
import { users } from "./auth";
import { products } from "./products";

/**
 * Registro de cada ejecución de sincronización.
 * Una sync run = un job de scraping procesado.
 */
export const syncReports = pgTable(
	"sync_reports",
	{
		...primaryKey,

		jobId: varchar("job_id", { length: 128 }),
		trigger: varchar("trigger", { length: 50 }).notNull().default("manual"),

		status: varchar("status", { length: 50 }).notNull().default("running"),

		stats: jsonb("stats").$type<SyncStats>().notNull().default({
			processed: 0,
			created: 0,
			updated: 0,
			unchanged: 0,
			errors: 0,
			outOfStock: 0,
		}),

		errorMessage: text("error_message"),

		startedAt: timestamp("started_at").notNull().defaultNow(),
		completedAt: timestamp("completed_at"),
	},
	(table) => [
		index("sync_reports_status_idx").on(table.status),
		index("sync_reports_started_at_idx").on(table.startedAt),
	],
);

export type SyncStats = {
	processed: number;
	created: number;
	updated: number;
	unchanged: number;
	errors: number;
	outOfStock: number;
};

/**
 * Flat primitive map used in `productChanges.oldValue` / `.newValue`.
 * `null` represents a cleared field (e.g. `{ rawPrice: null }`).
 */
export type ChangeValueObject = Record<string, string | number | boolean | null>;

/**
 * Discriminated union of all known notification payloads.
 * Why a union: a wider `Record<string, …>` let the worker pass `JSON.stringify(stats)`
 * (a string) where the consumer expected an object, and TypeScript could not catch it.
 * Each variant narrows the shape, so the wrong type is now a compile error.
 *
 * To add a new notification type:
 *   1. Add a variant here.
 *   2. Add a `buildXxxNotification` factory in `notifications.service`.
 */
export type NotificationData = SyncNotificationData | OrderNotificationData;

export type SyncNotificationData = {
	reportId?: string;
	jobId?: string;
	trigger?: "manual" | "automatic" | string;
	startedAt?: string;
	completedAt?: string;
	stats?: SyncStats;
};

export type OrderNotificationData = {
	orderId?: string;
	orderNumber?: string;
	total?: string;
	reason?: string;
	timestamp?: string;
};

/**
 * Auditoría inmutable de cambios por producto.
 * Cada row = un campo que cambió durante un sync o acción admin.
 */
export const productChanges = pgTable(
	"product_changes",
	{
		...primaryKey,

		productId: uuid("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),

		syncReportId: uuid("sync_report_id").references(() => syncReports.id, {
			onDelete: "set null",
		}),

		userId: uuid("user_id").references(() => users.id, {
			onDelete: "set null",
		}),

		source: varchar("source", { length: 50 }).notNull(), // "sync" | "admin" | "system"
		changeType: varchar("change_type", { length: 50 }).notNull(),
		field: varchar("field", { length: 50 }),

		oldValue: jsonb("old_value").$type<ChangeValueObject | null>(),
		newValue: jsonb("new_value").$type<ChangeValueObject | null>(),

		reason: text("reason"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		index("product_changes_product_idx").on(table.productId),
		index("product_changes_report_idx").on(table.syncReportId),
		index("product_changes_type_idx").on(table.changeType),
	],
);

/**
 * Notificaciones para el panel admin.
 * Persiste en DB + se emiten por WebSocket en tiempo real.
 */
export const adminNotifications = pgTable(
	"admin_notifications",
	{
		...primaryKey,

		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		type: varchar("type", { length: 50 }).notNull(),

		title: varchar("title", { length: 255 }).notNull(),
		message: text("message"),

		data: jsonb("data").$type<NotificationData | null>(),

		isRead: boolean("is_read").notNull().default(false),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		index("admin_notifications_user_idx").on(table.userId),
		index("admin_notifications_unread_idx")
			.on(table.userId, table.isRead)
			.where(sql`${table.isRead} = false`),
	],
);
