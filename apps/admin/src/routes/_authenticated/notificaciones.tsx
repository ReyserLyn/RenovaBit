import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { NotificationDetail } from "@/features/notifications/components/notification-detail";
import { NotificationTable } from "@/features/notifications/components/notification-table";
import { useMarkAsRead } from "@/features/notifications/hooks/notification-mutations";
import { notificationKeys } from "@/features/notifications/hooks/notification-queries";
import type { AppNotification, NotificationData } from "@/features/notifications/model";
import { notificationDataSchema } from "@/features/notifications/model";
import { PageHeader } from "@/shared/components/layout/page-header";

export const Route = createFileRoute("/_authenticated/notificaciones")({
	validateSearch: z.object({
		id: z.string().optional(),
	}),
	component: NotificacionesPage,
});

function NotificacionesPage() {
	const [selectedId, setSelectedId] = useQueryState("id", parseAsString);
	const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
	const queryClient = useQueryClient();
	const markReadMutation = useMarkAsRead();

	useEffect(() => {
		const check = () => {
			if (!selectedId) {
				setSelectedNotification(null);
				return;
			}
			const queries = queryClient.getQueriesData<{
				notifications: AppNotification[];
			}>({
				queryKey: notificationKeys.lists(),
			});
			for (const [, qData] of queries) {
				const found = qData?.notifications.find((n) => n.id === selectedId);
				if (found) {
					setSelectedNotification(found);
					return;
				}
			}
		};

		check();
		const unsubscribe = queryClient.getQueryCache().subscribe(check);
		return unsubscribe;
	}, [selectedId, queryClient]);

	const handleRowClick = useCallback(
		(notification: AppNotification) => {
			if (notification.id === selectedId) {
				setSelectedId(null);
				setSelectedNotification(null);
			} else {
				setSelectedId(notification.id);
				setSelectedNotification(notification);
				if (!notification.isRead) {
					markReadMutation.mutate(notification.id);
				}
			}
		},
		[selectedId, setSelectedId, markReadMutation],
	);

	const parsedData = selectedNotification
		? notificationDataSchema.safeParse(selectedNotification.data).data
		: null;

	return (
		<div className="flex flex-col gap-6 min-h-0">
			<PageHeader
				title="Notificaciones"
				description="Revisa pedidos, sincronizaciones y actividad del sistema."
			/>

			<div className={`grid flex-1 min-h-0 gap-4 ${selectedNotification ? "lg:grid-cols-2" : ""}`}>
				<NotificationTable onRowClick={handleRowClick} selectedId={selectedId} />

				{selectedNotification && parsedData && (
					<div className="lg:self-start">
						<NotificationDetail notification={selectedNotification} parsedData={parsedData} />
					</div>
				)}
			</div>
		</div>
	);
}
