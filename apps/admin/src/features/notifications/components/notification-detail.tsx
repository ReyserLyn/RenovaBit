import { Avatar, AvatarFallback } from "@renovabit/ui/components/ui/avatar";
import { Button } from "@renovabit/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@renovabit/ui/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@renovabit/ui/components/ui/select";
import { Separator } from "@renovabit/ui/components/ui/separator";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import { useMemo, useState } from "react";
import { useReportChanges } from "@/features/reports/hooks/reports-queries";
import type { ReportChange } from "@/features/reports/model";
import {
	RichSyncStats,
	SyncCountersGrid,
} from "@/features/sync-reports/components/rich-sync-stats";
import { formatDateTimeSeconds, formatDuration } from "@/shared/lib/format-date";
import { getUserDisplayName, getUserInitials } from "../lib/user-helpers";
import type { AppNotification, NotificationData, SortOption } from "../model";
import { isSortOption, SORT_OPTIONS } from "../model";
import { ChangeRow } from "./change-row";
import { TriggerBadge } from "./trigger-badge";

// ── TimelineStep ───────────────────────────────────

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

// ── NotificationParseError ─────────────────────────

/**
 * Estado explícito para notificaciones cuyo `data` no cumple el esquema.
 * Antes el panel simplemente no renderizaba nada (área en blanco).
 */
export function NotificationParseError({ notification }: { notification: AppNotification }) {
	const user = notification.user;

	return (
		<Card>
			<CardHeader className="border-b">
				<div className="flex items-center gap-3 min-w-0">
					<Avatar size="sm">
						<AvatarFallback>{getUserInitials(user)}</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
						<CardTitle className="truncate">{notification.title}</CardTitle>
						<CardDescription>{getUserDisplayName(user)}</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent className="pt-4">
				<div className="rounded-md border border-warning/20 bg-warning/5 px-3 py-2">
					<p className="text-sm font-medium">No se pudo interpretar la notificación</p>
					<p className="text-muted-foreground text-xs">
						Los datos guardados no coinciden con el formato esperado. La notificación permanece en
						la tabla, pero este panel no puede mostrar su detalle.
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

// ── NotificationDetail ─────────────────────────────

export function NotificationDetail({
	notification,
	parsedData,
}: {
	notification: AppNotification;
	parsedData: NotificationData;
}) {
	const user = notification.user;
	const [showChanges, setShowChanges] = useState(false);
	const [sortBy, setSortBy] = useState<SortOption>("name-asc");
	const reportId = parsedData.reportId;
	const { data: changesData, isPending: changesLoading } = useReportChanges(
		showChanges && reportId ? reportId : "",
	);

	const hasStats = !!parsedData.stats;
	const hasChanges =
		hasStats && ((parsedData.stats?.created ?? 0) > 0 || (parsedData.stats?.updated ?? 0) > 0);
	const rawChanges = changesData?.changes ?? [];

	const changes = useMemo(() => {
		const sorted: ReportChange[] = [...rawChanges];
		const cmpStr = (a: string, b: string) => String(a).localeCompare(String(b));
		switch (sortBy) {
			case "name-asc":
				sorted.sort(
					(a, b) => cmpStr(a.productName, b.productName) || cmpStr(b.createdAt, a.createdAt),
				);
				break;
			case "name-desc":
				sorted.sort(
					(a, b) => cmpStr(b.productName, a.productName) || cmpStr(b.createdAt, a.createdAt),
				);
				break;
			case "type":
				sorted.sort(
					(a, b) =>
						String(a.changeType).localeCompare(String(b.changeType)) ||
						cmpStr(a.productName, b.productName),
				);
				break;
			case "newest":
			default:
				sorted.sort((a, b) => cmpStr(b.createdAt, a.createdAt));
				break;
		}
		return sorted;
	}, [rawChanges, sortBy]);

	// ── Vista específica para notificaciones de pedidos ──

	if (parsedData.orderId) {
		return (
			<Card>
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
					</div>
				</CardHeader>

				<CardContent className="space-y-3 pt-4">
					{parsedData.orderNumber && (
						<p className="text-sm">
							<span className="text-muted-foreground">Pedido:</span> {parsedData.orderNumber}
						</p>
					)}
					{parsedData.total && (
						<p className="text-sm">
							<span className="text-muted-foreground">Total:</span> S/ {parsedData.total}
						</p>
					)}
					{parsedData.reason && (
						<p className="text-sm">
							<span className="text-muted-foreground">Motivo:</span> {parsedData.reason}
						</p>
					)}
					{parsedData.timestamp && (
						<p className="text-xs text-muted-foreground">
							{formatDateTimeSeconds(parsedData.timestamp)}
						</p>
					)}
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={showChanges ? "pb-0" : ""}>
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

			<CardContent className={`space-y-4 pt-4 ${showChanges ? "pb-0" : ""}`}>
				{(parsedData.jobId || parsedData.reportId) && (
					<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
						{parsedData.jobId && <span>Job: {parsedData.jobId}</span>}
						{parsedData.reportId && <span>Reporte: {parsedData.reportId}</span>}
					</div>
				)}

				{parsedData.errorMessage && (
					<div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
						<p className="text-xs font-medium text-destructive">La sincronización falló</p>
						<p className="text-xs break-words text-muted-foreground">{parsedData.errorMessage}</p>
					</div>
				)}

				<Separator />

				{parsedData.startedAt && (
					<div className="space-y-0">
						<TimelineStep label="Inicio" time={formatDateTimeSeconds(parsedData.startedAt)} />
						{parsedData.completedAt && (
							<TimelineStep label="Fin" time={formatDateTimeSeconds(parsedData.completedAt)} />
						)}
						<TimelineStep
							label="Notificación creada"
							time={formatDateTimeSeconds(notification.createdAt)}
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

				{hasStats && (
					<>
						<Separator />
						<SyncCountersGrid stats={parsedData.stats!} />
						<RichSyncStats
							stats={parsedData.stats!}
							startedAt={parsedData.startedAt}
							completedAt={parsedData.completedAt}
						/>
					</>
				)}

				{hasChanges && (
					<Button
						variant="outline"
						size="lg"
						className="w-full"
						onClick={() => setShowChanges((prev) => !prev)}
					>
						{showChanges
							? "Ocultar cambios"
							: `Ver cambios (${(parsedData.stats?.created ?? 0) + (parsedData.stats?.updated ?? 0)})`}
					</Button>
				)}
			</CardContent>

			{showChanges && (
				<div className="border-t">
					<div className="flex items-center justify-between px-4 py-2">
						<span className="text-xs text-muted-foreground">{changes.length} cambios</span>
						<Select
							items={SORT_OPTIONS}
							value={sortBy}
							onValueChange={(value) => setSortBy(isSortOption(value) ? value : "name-asc")}
						>
							<SelectTrigger className="h-7 w-[140px] text-xs">
								<SelectValue placeholder="Ordenar" />
							</SelectTrigger>
							<SelectContent>
								{SORT_OPTIONS.map((opt: { label: string; value: string }) => (
									<SelectItem key={opt.value} value={opt.value}>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{changesLoading && changes.length === 0 ? (
						<div className="space-y-0 px-4 pb-4">
							{[...Array(3)].map((_, i) => (
								<Skeleton key={`skel-${i}`} className="h-14 w-full rounded-lg" />
							))}
						</div>
					) : changes.length > 0 ? (
						<div className="max-h-[500px] overflow-y-auto">
							{changes.map((c) => (
								<ChangeRow key={c.id} change={c} />
							))}
						</div>
					) : null}
				</div>
			)}
		</Card>
	);
}
