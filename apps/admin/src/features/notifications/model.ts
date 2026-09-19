import { z } from "zod";
import { CHANGE_LABELS } from "@/features/reports/model";

// ── Schemas ────────────────────────────────────────

const syncFailedItemSchema = z.object({
	providerId: z.string(),
	reason: z.string(),
});

const syncAiStatsSchema = z.object({
	calls: z.number(),
	failed: z.number(),
	inputTokens: z.number(),
	outputTokens: z.number(),
	costUsd: z.number(),
});

const syncImageStatsSchema = z.object({
	checked: z.number(),
	processed: z.number(),
	missing: z.number(),
});

/**
 * Sync stats arrive in two shapes and both must survive parsing:
 *  - full `SyncStats` (WebSocket progress/completed events, report detail)
 *  - flat notification payload (DB notifications; arrays are pre-joined)
 * Everything beyond the 6 base counters is optional so either shape parses.
 */
export const syncStatsSchema = z.object({
	processed: z.number(),
	created: z.number(),
	updated: z.number(),
	unchanged: z.number(),
	errors: z.number(),
	outOfStock: z.number(),
	// Full SyncStats shape.
	failedItems: z.array(syncFailedItemSchema).optional(),
	ai: syncAiStatsSchema.optional(),
	images: syncImageStatsSchema.optional(),
	unavailableMarked: z.number().optional(),
	zeroingSkipped: z.boolean().optional(),
	blacklistedRemoved: z.number().optional(),
	durationMs: z.number().optional(),
	// Flat notification payload shape.
	failedCount: z.number().optional(),
	failedSample: z.string().optional(),
	aiCalls: z.number().optional(),
	aiFailed: z.number().optional(),
	aiCostUsd: z.number().optional(),
	imagesChecked: z.number().optional(),
	imagesProcessed: z.number().optional(),
	imagesMissing: z.number().optional(),
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
	errorMessage: z.string().optional(),
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

export type SyncFailedEvent = {
	reportId?: string;
	jobId?: string;
	trigger?: string;
	errorMessage?: string;
	completedAt?: string;
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
	sync_failed: "Sync fallida",
	"order:created": "Pedido",
	"order:auto-cancelled": "Cancelación",
	order_created: "Pedido",
	"complaint:created": "Nueva hoja de reclamación",
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
