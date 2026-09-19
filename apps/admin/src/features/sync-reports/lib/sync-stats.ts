/**
 * Sync stats reach the admin in two shapes:
 *  - the full `SyncStats` object (WebSocket events, report detail endpoint)
 *  - the flattened notification payload (DB notifications, where arrays travel
 *    pre-joined as `failedSample`)
 * The views only need one shape — this normalizer hides the difference.
 */

import { formatDuration, formatDurationMs } from "@/shared/lib/format-date";

export type SyncStatsLike = {
	failedItems?: Array<{ providerId: string; reason: string }>;
	ai?: { calls: number; failed: number; costUsd: number };
	images?: { checked: number; missing: number };
	unavailableMarked?: number;
	zeroingSkipped?: boolean;
	blacklistedRemoved?: number;
	durationMs?: number;
	failedCount?: number;
	failedSample?: string;
	aiCalls?: number;
	aiFailed?: number;
	aiCostUsd?: number;
	imagesChecked?: number;
	imagesMissing?: number;
};

export type NormalizedSyncStats = {
	aiCostUsd: number | null;
	aiCalls: number | null;
	aiFailed: number | null;
	imagesChecked: number | null;
	imagesMissing: number | null;
	durationMs: number | null;
	failedCount: number;
	failedReasons: string[];
	zeroingSkipped: boolean | null;
	blacklistedRemoved: number | null;
	unavailableMarked: number | null;
};

export function normalizeSyncStats(stats: SyncStatsLike): NormalizedSyncStats {
	const failedItems = stats.failedItems ?? [];

	return {
		aiCostUsd: stats.ai?.costUsd ?? stats.aiCostUsd ?? null,
		aiCalls: stats.ai?.calls ?? stats.aiCalls ?? null,
		aiFailed: stats.ai?.failed ?? stats.aiFailed ?? null,
		imagesChecked: stats.images?.checked ?? stats.imagesChecked ?? null,
		imagesMissing: stats.images?.missing ?? stats.imagesMissing ?? null,
		durationMs: stats.durationMs ?? null,
		failedCount: failedItems.length > 0 ? failedItems.length : (stats.failedCount ?? 0),
		failedReasons:
			failedItems.length > 0
				? failedItems.map((item) => `${item.providerId}: ${item.reason}`)
				: (stats.failedSample?.split(" · ") ?? []),
		zeroingSkipped: stats.zeroingSkipped ?? null,
		blacklistedRemoved: stats.blacklistedRemoved ?? null,
		unavailableMarked: stats.unavailableMarked ?? null,
	};
}

type ReportDurationInput = {
	status: string;
	startedAt: string;
	completedAt: string | null;
	stats: { durationMs?: number };
};

/** Duration for the reports table/dialog: stored ms, else date diff, else label. */
export function formatReportDuration(report: ReportDurationInput): string {
	if (report.status === "running") return "En curso";
	if ((report.stats.durationMs ?? 0) > 0) return formatDurationMs(report.stats.durationMs ?? 0);
	if (report.completedAt) return formatDuration(report.startedAt, report.completedAt);
	return "—";
}
