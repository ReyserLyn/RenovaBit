import { Avatar, AvatarFallback } from "@renovabit/ui/components/ui/avatar";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@renovabit/ui/components/ui/card";
import { Separator } from "@renovabit/ui/components/ui/separator";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useState } from "react";
import { NotificationTable } from "@/features/notifications/components/notification-table";
import { useMarkAsRead } from "@/features/notifications/hooks/notification-mutations";
import type {
	AppNotification,
	NotificationData,
	SyncStats,
	UserInfo,
} from "@/features/notifications/model";
import { notificationDataSchema } from "@/features/notifications/model";
import { PageHeader } from "@/shared/components/layout/page-header";

export const Route = createFileRoute("/_authenticated/notificaciones")({
	validateSearch: (search: Record<string, unknown>): { id?: string } => ({
		id: (search.id as string) || undefined,
	}),
	component: NotificacionesPage,
});

// ── Helpers ────────────────────────────────────────

function formatDateTime(iso: string): string {
	return new Date(iso).toLocaleString("es-PE", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

function formatDuration(start: string, end: string): string {
	const ms = new Date(end).getTime() - new Date(start).getTime();
	const seconds = Math.round(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
	return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function getUserDisplayName(user: UserInfo | null): string {
	if (!user) return "—";
	return user.displayUsername || user.username || user.email || user.id;
}

function getUserInitials(user: UserInfo | null): string {
	if (!user) return "?";
	const name = user.displayUsername || user.username || user.email;
	if (!name) return "?";
	return name.slice(0, 2).toUpperCase();
}

// ── Sub-componentes ────────────────────────────────

function TriggerBadge({ trigger }: { trigger?: string }) {
	if (!trigger) return null;
	const variant = trigger === "manual" ? ("warning" as const) : ("info" as const);
	const label = trigger === "manual" ? "Manual" : "Automático";
	return (
		<Badge variant={variant} size="sm">
			{label}
		</Badge>
	);
}

function StatsGrid({ stats }: { stats: SyncStats }) {
	return (
		<div className="grid grid-cols-3 gap-2">
			<StatCell value={stats.processed} label="Procesados" />
			<StatCell
				value={stats.created}
				label="Nuevos"
				variant={stats.created > 0 ? "success" : undefined}
			/>
			<StatCell
				value={stats.updated}
				label="Actualizados"
				variant={stats.updated > 0 ? "warning" : undefined}
			/>
			<StatCell value={stats.unchanged} label="Sin cambios" />
			<StatCell
				value={stats.errors}
				label="Errores"
				variant={stats.errors > 0 ? "destructive" : undefined}
			/>
			<StatCell value={stats.outOfStock} label="Sin stock" />
		</div>
	);
}

function StatCell({
	value,
	label,
	variant,
}: {
	value: number;
	label: string;
	variant?: "success" | "warning" | "destructive";
}) {
	const textColor =
		variant === "success"
			? "text-success"
			: variant === "warning"
				? "text-warning"
				: variant === "destructive"
					? "text-destructive"
					: "text-foreground";

	return (
		<div className="flex flex-col items-center rounded-md bg-muted/40 py-3">
			<span className={`text-2xl font-bold tabular-nums leading-none ${textColor}`}>{value}</span>
			<span className="text-muted-foreground text-xs mt-1">{label}</span>
		</div>
	);
}

// ── Detail Card ────────────────────────────────────

function NotificationDetail({
	notification,
	parsedData,
}: {
	notification: AppNotification;
	parsedData: NotificationData;
}) {
	const user = notification.user;
	const navigate = useNavigate();
	const hasChanges =
		parsedData.stats && (parsedData.stats.created > 0 || parsedData.stats.updated > 0);

	return (
		<Card size="sm">
			<CardHeader className="border-b">
				<div className="flex items-start justify-between gap-2">
					<div className="flex items-center gap-3 min-w-0">
						<Avatar size="sm">
							<AvatarFallback>{getUserInitials(user)}</AvatarFallback>
						</Avatar>
						<div className="min-w-0">
							<CardTitle className="truncate">{notification.title}</CardTitle>
							<CardDescription>{getUserDisplayName(user)}</CardDescription>
						</div>
					</div>
					<TriggerBadge trigger={parsedData.trigger} />
				</div>
			</CardHeader>

			<CardContent className="space-y-4 pt-4">
				{/* IDs compactos */}
				{(parsedData.jobId || parsedData.reportId) && (
					<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
						{parsedData.jobId && <span>Job: {parsedData.jobId}</span>}
						{parsedData.reportId && <span>Reporte: {parsedData.reportId}</span>}
					</div>
				)}

				<Separator />

				{/* Timeline */}
				{parsedData.startedAt && (
					<div className="space-y-0">
						<TimelineStep label="Inicio" time={formatDateTime(parsedData.startedAt)} />
						{parsedData.completedAt && (
							<TimelineStep label="Fin" time={formatDateTime(parsedData.completedAt)} />
						)}
						<TimelineStep
							label="Notificación creada"
							time={formatDateTime(notification.createdAt)}
							isLast={!parsedData.completedAt}
						/>
						{parsedData.completedAt && (
							<TimelineStep
								label="Duración"
								time={formatDuration(parsedData.startedAt, parsedData.completedAt)}
								isLast
							/>
						)}
					</div>
				)}

				{/* Stats */}
				{parsedData.stats && (
					<>
						<Separator />
						<StatsGrid stats={parsedData.stats} />
					</>
				)}

				{/* Acción: solo si hubo cambios reales */}
				{hasChanges && (
					<Button
						variant="outline"
						size="lg"
						className="w-full"
						onClick={() =>
							navigate({
								to: "/sync-report/$reportId",
								params: { reportId: parsedData.reportId! },
							})
						}
					>
						Ver cambios de productos
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

function TimelineStep({ label, time, isLast }: { label: string; time: string; isLast?: boolean }) {
	return (
		<div className="flex gap-3">
			<div className="flex flex-col items-center pt-1.5">
				<div className="size-2 rounded-full border-2 border-muted-foreground/30" />
				{!isLast && <div className="w-px flex-1 bg-border" />}
			</div>
			<div className="pb-3">
				<span className="text-muted-foreground text-xs">{label}</span>
				<p className="text-sm font-medium">{time}</p>
			</div>
		</div>
	);
}

// ── Página ─────────────────────────────────────────

function NotificacionesPage() {
	const [selectedId, setSelectedId] = useQueryState("id", parseAsString);
	const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
	const markReadMutation = useMarkAsRead();

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
		? (notificationDataSchema.parse(selectedNotification.data) as NotificationData)
		: null;

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Notificaciones"
				description="Revisa el historial de sincronizaciones y actividad del sistema."
			/>

			<div className={`grid flex-1 min-h-0 gap-4 ${selectedNotification ? "lg:grid-cols-2" : ""}`}>
				<NotificationTable onRowClick={handleRowClick} selectedId={selectedId} />

				{selectedNotification && parsedData && (
					<NotificationDetail notification={selectedNotification} parsedData={parsedData} />
				)}
			</div>
		</div>
	);
}
