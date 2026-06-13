import { Notification02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@renovabit/ui/components/ui/dropdown-menu";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatTime } from "@/shared/lib/format-date";
import { useNotifications } from "../context/notifications-context";
import type { AppNotification } from "../model";
import { notificationDataSchema } from "../model";

function formatSummary(notification: AppNotification): string {
	const result = notificationDataSchema.safeParse(notification.data);
	const data = result.success ? result.data : undefined;

	if (data?.orderNumber) {
		return `Pedido ${data.orderNumber}${data.total ? ` — S/ ${data.total}` : ""}`;
	}

	if (data?.stats) {
		const s = data.stats;
		return `${s.processed} procesados · ${s.created} creados · ${s.updated} actualizados`;
	}

	return notification.message ?? notification.title;
}

export function NotificationBell() {
	const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
	const navigate = useNavigate();

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger
				render={
					<Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
						<HugeiconsIcon icon={Notification02Icon} className="size-5" />
						{unreadCount > 0 && (
							<span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
								{unreadCount > 99 ? "99+" : unreadCount}
							</span>
						)}
					</Button>
				}
			/>

			<DropdownMenuContent align="end" className="w-80">
				<div className="flex items-center justify-between px-3 py-2">
					<span className="font-medium text-sm">Notificaciones</span>
					{unreadCount > 0 && (
						<Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
							Marcar todas leídas
						</Button>
					)}
				</div>

				<DropdownMenuSeparator />

				{notifications.length === 0 ? (
					<div className="px-3 py-6 text-center text-muted-foreground text-sm">
						No hay notificaciones
					</div>
				) : (
					notifications.map((n) => (
						<DropdownMenuItem
							key={n.id}
							className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
							onClick={() => {
								if (!n.isRead) markAsRead(n.id);
								navigate({ to: "/notificaciones", search: { id: n.id } });
							}}
						>
							<div className="flex w-full items-start justify-between gap-2">
								<div className="flex-1 min-w-0">
									<p className="text-xs text-muted-foreground">{formatTime(n.createdAt)}</p>
									<p className="text-sm">{formatSummary(n)}</p>
								</div>
								{!n.isRead && (
									<Button
										variant="ghost"
										size="icon"
										className="size-6 shrink-0"
										aria-label="Marcar como leída"
										onClick={(e) => {
											e.stopPropagation();
											e.preventDefault();
											markAsRead(n.id);
										}}
									>
										<HugeiconsIcon icon={Tick02Icon} className="size-3" />
									</Button>
								)}
							</div>
						</DropdownMenuItem>
					))
				)}

				{notifications.length > 0 && (
					<>
						<DropdownMenuSeparator />
						<Link
							to="/notificaciones"
							className="flex w-full items-center justify-center rounded-b-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
						>
							Ver todas
						</Link>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
