import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import type { SyncReportStatus } from "../model";
import { syncReportsService } from "../service/sync-reports.service";

// ── Query Key Factory ──────────────────────────────────

export const syncReportKeys = {
	all: ["sync-reports"] as const,
	lists: () => [...syncReportKeys.all, "list"] as const,
	list: (params: { page: number; pageSize: number; status?: SyncReportStatus }) =>
		[...syncReportKeys.lists(), params] as const,
	details: () => [...syncReportKeys.all, "detail"] as const,
	detail: (id: string) => [...syncReportKeys.details(), id] as const,
};

// ── Query Options ──────────────────────────────────────

export const syncReportsQueryOptions = (params: {
	page: number;
	pageSize: number;
	status?: SyncReportStatus;
}) =>
	queryOptions({
		queryKey: syncReportKeys.list(params),
		queryFn: () =>
			syncReportsService.list({
				page: params.page,
				limit: params.pageSize,
				status: params.status,
			}),
		placeholderData: keepPreviousData,
		staleTime: 10_000,
		// Mientras haya un sync en curso, refrescar seguido para ver el avance.
		// En reposo, un refresco lento cubre la ventana entre encolar el job y
		// que el worker cree el reporte; nunca se queda mostrando datos muertos.
		refetchInterval: (query) =>
			query.state.data?.reports.some((report) => report.status === "running") ? 5000 : 15_000,
	});

export const syncReportDetailQueryOptions = (reportId: string) =>
	queryOptions({
		queryKey: syncReportKeys.detail(reportId),
		queryFn: () => syncReportsService.getById(reportId),
		enabled: reportId.length > 0,
		staleTime: 30_000,
	});

// ── Queries ────────────────────────────────────────────

export function useSyncReports(params: {
	page: number;
	pageSize: number;
	status?: SyncReportStatus;
}) {
	return useQuery(syncReportsQueryOptions(params));
}

export function useSyncReportDetail(reportId: string) {
	return useQuery(syncReportDetailQueryOptions(reportId));
}
