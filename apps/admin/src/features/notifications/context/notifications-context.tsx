import { useQueryClient } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
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
	const [progress, setProgress] = useState<SyncProgress | null>(null);
	const [lastCompleted, setLastCompleted] = useState<SyncCompletedEvent | null>(null);
	const completedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const { data } = useNotificationsList(4);

	const isConnected = useWebSocket({
		onProgress: useCallback((p: SyncProgress) => {
			setProgress(p);
		}, []),
		onCompleted: useCallback(
			(e: SyncCompletedEvent) => {
				setProgress(null);
				setLastCompleted(e);

				const { processed, created, updated, errors } = e.stats;
				toast.success(
					`Sync completado: ${processed} procesados, ${created} creados, ${updated} actualizados${errors > 0 ? `, ${errors} errores` : ""}`,
				);

				completedTimeoutRef.current = setTimeout(() => setLastCompleted(null), 10_000);

				queryClient.invalidateQueries({ queryKey: ["notifications"] });
			},
			[queryClient],
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
		setLastCompleted(null);
	}, []);

	const value = useMemo<NotificationsContextValue>(
		() => ({
			notifications: data?.notifications ?? [],
			total: data?.total ?? 0,
			unreadCount: data?.unreadCount ?? 0,
			progress,
			lastCompleted,
			isConnected,
			markAsRead: markReadMutation.mutate,
			markAllAsRead: markAllReadMutation.mutate,
			clearCompleted,
		}),
		[data, progress, lastCompleted, isConnected, clearCompleted],
	);

	return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
	const ctx = useContext(NotificationsContext);
	if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
	return ctx;
}
