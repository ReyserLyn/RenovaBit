import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { notificationsService } from "../service/notifications.service";

// ── Query Key Factory ──────────────────────────────────

export const notificationKeys = {
	all: ["notifications"] as const,
	lists: () => [...notificationKeys.all, "list"] as const,
	list: (filters?: Record<string, unknown>) =>
		[...notificationKeys.lists(), ...(filters ? [filters] : [])] as const,
	paginated: (params: { page: number; pageSize: number; search?: string }) =>
		[...notificationKeys.lists(), "paginated", params] as const,
};

// ── Query Options — Bell (pocas notificaciones) ─────

export const notificationsQueryOptions = (limit = 4) =>
	queryOptions({
		queryKey: notificationKeys.list({ limit }),
		queryFn: () => notificationsService.list({ limit }),
		placeholderData: keepPreviousData,
		staleTime: 10_000,
	});

// ── Query Options — Tabla (server-side pagination) ─

export const notificationsPaginatedQueryOptions = (params: {
	page: number;
	pageSize: number;
	search?: string;
}) =>
	queryOptions({
		queryKey: notificationKeys.paginated(params),
		queryFn: () =>
			notificationsService.list({
				page: params.page,
				limit: params.pageSize,
				search: params.search || undefined,
			}),
		placeholderData: keepPreviousData,
		staleTime: 30_000,
	});

// ── Queries ────────────────────────────────────────────

export function useNotificationsList(limit = 4) {
	return useQuery(notificationsQueryOptions(limit));
}
