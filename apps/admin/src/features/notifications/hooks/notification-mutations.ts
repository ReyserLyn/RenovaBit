import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppNotification } from "../model";
import { notificationsService } from "../service/notifications.service";
import { notificationKeys } from "./notification-queries";

// ── Mutations ──────────────────────────────────────────

export function useMarkAsRead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => notificationsService.markAsRead(id),
		onMutate: async (id) => {
			// Cancelar refetches en curso para evitar sobreescribir
			await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });

			// Snapshot del estado anterior
			const previous = queryClient.getQueriesData<{
				notifications: AppNotification[];
				total: number;
				unreadCount: number;
			}>({ queryKey: notificationKeys.lists() });

			// Actualización optimista: marcar como leído en todas las queries de lista
			for (const [queryKey, queryData] of previous) {
				if (!queryData) continue;

				queryClient.setQueryData(queryKey, {
					...queryData,
					notifications: queryData.notifications.map((n) =>
						n.id === id ? { ...n, isRead: true } : n,
					),
					unreadCount: Math.max(0, queryData.unreadCount - 1),
				});
			}

			return { previous };
		},
		onError: (_err, _id, context) => {
			// Revertir al estado anterior
			if (context?.previous) {
				for (const [queryKey, queryData] of context.previous) {
					if (queryData) {
						queryClient.setQueryData(queryKey, queryData);
					}
				}
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
		},
	});
}

export function useMarkAllAsRead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => notificationsService.markAllAsRead(),
		onMutate: async () => {
			await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });

			const previous = queryClient.getQueriesData<{
				notifications: AppNotification[];
				total: number;
				unreadCount: number;
			}>({ queryKey: notificationKeys.lists() });

			for (const [queryKey, queryData] of previous) {
				if (!queryData) continue;

				queryClient.setQueryData(queryKey, {
					...queryData,
					notifications: queryData.notifications.map((n) => ({
						...n,
						isRead: true,
					})),
					unreadCount: 0,
				});
			}

			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				for (const [queryKey, queryData] of context.previous) {
					if (queryData) {
						queryClient.setQueryData(queryKey, queryData);
					}
				}
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
		},
	});
}
