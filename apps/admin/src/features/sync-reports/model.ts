// ── Sync reports domain types ──────────────────────
// Espejo del contrato de `GET /api/v1/admin/reports` y `/:reportId`.

export type SyncReportStatus = "running" | "completed" | "failed";

export interface SyncReportStatsSummary {
	processed: number;
	created: number;
	updated: number;
	unchanged: number;
	errors: number;
	outOfStock: number;
	failedCount: number;
	aiCostUsd: number;
	durationMs: number;
}

export interface SyncFailedItem {
	providerId: string;
	reason: string;
}

export interface SyncReportStats {
	processed: number;
	created: number;
	updated: number;
	unchanged: number;
	errors: number;
	outOfStock: number;
	failedItems?: SyncFailedItem[];
	ai?: {
		calls: number;
		failed: number;
		inputTokens: number;
		outputTokens: number;
		costUsd: number;
	};
	images?: { checked: number; processed: number; missing: number };
	unavailableMarked?: number;
	zeroingSkipped?: boolean;
	blacklistedRemoved?: number;
	durationMs?: number;
}

export interface SyncReportBase {
	id: string;
	jobId: string | null;
	trigger: string;
	status: string;
	startedAt: string;
	completedAt: string | null;
	errorMessage: string | null;
}

export interface SyncReportSummary extends SyncReportBase {
	stats: SyncReportStatsSummary;
}

export interface SyncReportDetail extends SyncReportBase {
	stats: SyncReportStats;
}

// ── Filters ────────────────────────────────────────

export const SYNC_STATUS_OPTIONS = [
	{ label: "Todos", value: "all" },
	{ label: "En curso", value: "running" },
	{ label: "Completados", value: "completed" },
	{ label: "Fallidos", value: "failed" },
] as const;

export type SyncStatusFilter = (typeof SYNC_STATUS_OPTIONS)[number]["value"];

export function isSyncStatusFilter(value: string | null | undefined): value is SyncStatusFilter {
	return SYNC_STATUS_OPTIONS.some((option) => option.value === value);
}
