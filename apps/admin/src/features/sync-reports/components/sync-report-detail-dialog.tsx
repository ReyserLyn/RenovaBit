import { Button } from "@renovabit/ui/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@renovabit/ui/components/ui/dialog";
import { Separator } from "@renovabit/ui/components/ui/separator";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import { useState } from "react";
import { ChangeRow } from "@/features/notifications/components/change-row";
import { TriggerBadge } from "@/features/notifications/components/trigger-badge";
import { useReportChanges } from "@/features/reports/hooks/reports-queries";
import { formatDateTimeSeconds } from "@/shared/lib/format-date";
import { useSyncReportDetail } from "../hooks/sync-reports-queries";
import { formatReportDuration } from "../lib/sync-stats";
import { RichSyncStats, SyncCountersGrid } from "./rich-sync-stats";
import { SyncStatusBadge } from "./sync-status-badge";

export function SyncReportDetailDialog({
	reportId,
	open,
	onOpenChange,
}: {
	reportId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { data: report, isPending, isError, error } = useSyncReportDetail(reportId ?? "");
	const [showChanges, setShowChanges] = useState(false);
	const { data: changesData, isPending: changesLoading } = useReportChanges(
		showChanges && reportId ? reportId : "",
	);

	const changes = changesData?.changes ?? [];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85dvh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
				<DialogHeader className="border-b p-4">
					<div className="flex flex-wrap items-center gap-2">
						{report ? (
							<>
								<SyncStatusBadge status={report.status} />
								<TriggerBadge trigger={report.trigger} />
							</>
						) : (
							<Skeleton className="h-5 w-24 rounded-full" />
						)}
					</div>
					<DialogTitle>Reporte de sincronización</DialogTitle>
					<DialogDescription>
						{report
							? `${formatDateTimeSeconds(report.startedAt)}${
									report.completedAt
										? ` → ${formatDateTimeSeconds(report.completedAt)} · ${formatReportDuration(report)}`
										: " · en curso"
								}`
							: "Cargando reporte…"}
					</DialogDescription>
				</DialogHeader>

				<div className="max-h-[65dvh] space-y-4 overflow-y-auto p-4">
					{isPending && !report ? <Skeleton className="h-40 w-full rounded-lg" /> : null}

					{isError ? (
						<div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
							No se pudo cargar el reporte.
							{error instanceof Error ? ` ${error.message}` : ""}
						</div>
					) : null}

					{report ? (
						<>
							<div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
								<span>Reporte: {report.id}</span>
								{report.jobId ? <span>Job: {report.jobId}</span> : null}
							</div>

							{report.errorMessage ? (
								<div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
									<p className="text-xs font-medium text-destructive">La sincronización falló</p>
									<p className="text-xs break-words text-muted-foreground">{report.errorMessage}</p>
								</div>
							) : null}

							<SyncCountersGrid stats={report.stats} />

							<Separator />

							<RichSyncStats
								stats={report.stats}
								startedAt={report.startedAt}
								completedAt={report.completedAt}
								failedReasonsLimit={20}
							/>

							<Separator />

							<Button
								variant="outline"
								size="lg"
								className="w-full"
								onClick={() => setShowChanges((prev) => !prev)}
							>
								{showChanges ? "Ocultar cambios" : "Ver cambios de productos"}
							</Button>

							{showChanges ? (
								changesLoading && changes.length === 0 ? (
									<div className="space-y-2">
										{[...Array(3)].map((_, index) => (
											<Skeleton
												key={`change-skeleton-${index}`}
												className="h-12 w-full rounded-lg"
											/>
										))}
									</div>
								) : changes.length > 0 ? (
									<div className="max-h-[320px] overflow-y-auto rounded-md border">
										{changes.map((change) => (
											<ChangeRow key={change.id} change={change} />
										))}
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										Sin cambios de productos registrados.
									</p>
								)
							) : null}
						</>
					) : null}
				</div>
			</DialogContent>
		</Dialog>
	);
}
