import { z } from "zod";
import { CHANGE_LABELS } from "@/features/reports/model";

// ── Schemas ────────────────────────────────────────

export const syncStatsSchema = z.object({
	processed: z.number(),
	created: z.number(),
	updated: z.number(),
	unchanged: z.number(),
	errors: z.number(),
	outOfStock: z.number(),
});

// postgres-js convierte strings ISO 8601 dentro de jsonb a objetos Date.
// Este helper los normaliza a string sin importar qué entregue el driver.
const isoTimestamp = z
	.union([z.string(), z.date()])
	.transform((v) => (typeof v === "string" ? v : v.toISOString()));

export const notificationDataSchema = z.object({
	trigger: z.string().optional(),
	reportId: z.string().optional(),
	jobId: z.string().optional(),
	startedAt: isoTimestamp.optional(),
	completedAt: isoTimestamp.optional(),
	stats: syncStatsSchema.optional(),
	orderId: z.string().optional(),
	orderNumber: z.string().optional(),
	total: z.string().optional(),
	reason: z.string().optional(),
	timestamp: z.string().optional(),
});

export const userInfoSchema = z.object({
	id: z.string(),
	email: z.string(),
	username: z.string().nullable(),
	displayUsername: z.string().nullable(),
});

export const notificationSchema = z.object({
	id: z.string(),
	userId: z.string(),
	type: z.string(),
	title: z.string(),
	message: z.string().nullable(),
	data: z.unknown(),
	isRead: z.boolean(),
	createdAt: z.string(),
	user: userInfoSchema.nullable(),
});

// ── Types ──────────────────────────────────────────

export type AppNotification = z.infer<typeof notificationSchema>;
export type SyncStats = z.infer<typeof syncStatsSchema>;
export type NotificationData = z.infer<typeof notificationDataSchema>;
export type UserInfo = z.infer<typeof userInfoSchema>;

export type SyncProgress = SyncStats & { total: number; reportId: string };
export type SyncCompletedEvent = {
	reportId: string;
	stats: SyncStats;
	trigger: string;
};

export type OrderCreatedEvent = {
	orderId: string;
	orderNumber: string;
	total: string;
	timestamp: string;
};

export type OrderAutoCancelledEvent = {
	orderId: string;
	orderNumber: string;
	reason: string;
	timestamp: string;
};

// ── Change Type Labels ────────────────────────────
// Re-exportado desde reports/model

export { CHANGE_LABELS };

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
	sync_completed: "Sync",
	"order:created": "Pedido",
	"order:auto-cancelled": "Cancelación",
	order_created: "Pedido",
};

export const SORT_OPTIONS = [
	{ label: "Nombre A-Z", value: "name-asc" },
	{ label: "Nombre Z-A", value: "name-desc" },
	{ label: "Por tipo", value: "type" },
	{ label: "Más reciente", value: "newest" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export function isSortOption(value: string | null | undefined): value is SortOption {
	return SORT_OPTIONS.some((option) => option.value === value);
}
