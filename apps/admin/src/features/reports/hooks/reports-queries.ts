import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { reportsService } from "../service/reports.service";

// ── Query Key Factory ──────────────────────────────────

export const reportKeys = {
	all: ["reports"] as const,
	changes: (id: string) => [...reportKeys.all, "changes", id] as const,
	recent: (params: { page: number; pageSize: number; type?: string; search?: string }) =>
		[...reportKeys.all, "recent", params] as const,
};

// ── Query Options — Cambios de un reporte ─────────────

export const reportChangesQueryOptions = (reportId: string) =>
	queryOptions({
		queryKey: reportKeys.changes(reportId),
		queryFn: () => reportsService.getChanges(reportId),
		enabled: reportId.length > 0,
	});

// ── Query Options — Feed global (server-side pagination)

export const recentChangesQueryOptions = (params: {
	page: number;
	pageSize: number;
	type?: string;
	search?: string;
}) =>
	queryOptions({
		queryKey: reportKeys.recent(params),
		queryFn: () =>
			reportsService.listRecent({
				page: params.page,
				limit: params.pageSize,
				type: params.type || undefined,
				search: params.search || undefined,
			}),
		placeholderData: keepPreviousData,
		staleTime: 30_000,
	});

// ── Queries ────────────────────────────────────────────

export function useReportChanges(reportId: string) {
	return useQuery(reportChangesQueryOptions(reportId));
}
