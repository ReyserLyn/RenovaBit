import { useQueryClient } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
} from "react";
import { toast } from "sonner";
import { useSyncStore } from "@/shared/lib/stores/sync-store";
import { useMarkAllAsRead, useMarkAsRead } from "../hooks/notification-mutations";
import { useNotificationsList } from "../hooks/notification-queries";
import { useWebSocket } from "../hooks/use-websocket";
import type { AppNotification, SyncCompletedEvent, SyncProgress } from "../model";

type NotificationsContextValue = {
	notifications: AppNotification[];
	total: number;
	unreadCount: number;
	progress: SyncProgress | null;
	lastCompleted: SyncCompletedEvent | null;
	isConnected: boolean;
	markAsRead: (id: string) => void;
	markAllAsRead: () => void;
	clearCompleted: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const syncStore = useSyncStore();
	const completedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const { data } = useNotificationsList(4);

	const isConnected = useWebSocket({
		onProgress: useCallback(
			(p: SyncProgress) => {
				syncStore.setProgress(p);
			},
			[syncStore],
		),
		onCompleted: useCallback(
			(e: SyncCompletedEvent) => {
				syncStore.setCompleted(e);

				const { processed, created, updated, errors } = e.stats;
				toast.success(
					`Sync completado: ${processed} procesados, ${created} creados, ${updated} actualizados${errors > 0 ? `, ${errors} errores` : ""}`,
				);

				completedTimeoutRef.current = setTimeout(() => syncStore.clearCompleted(), 60_000);

				queryClient.invalidateQueries({ queryKey: ["notifications"] });
			},
			[queryClient, syncStore],
		),
	});

	const markReadMutation = useMarkAsRead();
	const markAllReadMutation = useMarkAllAsRead();

	// Limpiar timeout al desmontar
	useEffect(() => {
		return () => {
			if (completedTimeoutRef.current) {
				clearTimeout(completedTimeoutRef.current);
			}
		};
	}, []);

	const clearCompleted = useCallback(() => {
		if (completedTimeoutRef.current) {
			clearTimeout(completedTimeoutRef.current);
			completedTimeoutRef.current = null;
		}
		syncStore.clearCompleted();
	}, [syncStore]);

	const markAsRead = markReadMutation.mutate;
	const markAllAsRead = markAllReadMutation.mutate;

	const value = useMemo<NotificationsContextValue>(
		() => ({
			notifications: data?.notifications ?? [],
			total: data?.total ?? 0,
			unreadCount: data?.unreadCount ?? 0,
			progress: syncStore.progress,
			lastCompleted: syncStore.lastCompleted,
			isConnected,
			markAsRead,
			markAllAsRead,
			clearCompleted,
		}),
		[
			data,
			syncStore.progress,
			syncStore.lastCompleted,
			isConnected,
			markAsRead,
			markAllAsRead,
			clearCompleted,
		],
	);

	return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
	const ctx = useContext(NotificationsContext);
	if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
	return ctx;
}
