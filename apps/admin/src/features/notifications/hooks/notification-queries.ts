import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { notificationsService } from "../service/notifications.service";

// ── Query Key Factory ──────────────────────────────────

export const notificationKeys = {
	all: ["notifications"] as const,
	lists: () => [...notificationKeys.all, "list"] as const,
	list: (filters?: Record<string, unknown>) =>
		[...notificationKeys.lists(), ...(filters ? [filters] : [])] as const,
};

// ── Query Options ──────────────────────────────────────

export const notificationsQueryOptions = (limit = 4) =>
	queryOptions({
		queryKey: notificationKeys.list({ limit }),
		queryFn: () => notificationsService.list({ limit }),
		placeholderData: keepPreviousData,
		staleTime: 10_000,
	});

// ── Queries ────────────────────────────────────────────

export function useNotificationsList(limit = 4) {
	return useQuery(notificationsQueryOptions(limit));
}
