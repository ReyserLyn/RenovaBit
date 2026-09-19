import { Badge } from "@renovabit/ui/components/ui/badge";
import type { ReactNode } from "react";
import { formatDurationMs } from "@/shared/lib/format-date";
import { normalizeSyncStats, type SyncStatsLike } from "../lib/sync-stats";

const DEFAULT_REASONS_LIMIT = 3;

function CounterCell({
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

type SyncCounters = {
	processed: number;
	created: number;
	updated: number;
	unchanged: number;
	errors: number;
	outOfStock: number;
};

/** The 6 base counters, shared by the notification detail and report dialog. */
export function SyncCountersGrid({ stats }: { stats: SyncCounters }) {
	return (
		<div className="grid grid-cols-3 gap-2">
			<CounterCell value={stats.processed} label="Procesados" />
			<CounterCell
				value={stats.created}
				label="Nuevos"
				variant={stats.created > 0 ? "success" : undefined}
			/>
			<CounterCell
				value={stats.updated}
				label="Actualizados"
				variant={stats.updated > 0 ? "warning" : undefined}
			/>
			<CounterCell value={stats.unchanged} label="Sin cambios" />
			<CounterCell
				value={stats.errors}
				label="Errores"
				variant={stats.errors > 0 ? "destructive" : undefined}
			/>
			<CounterCell value={stats.outOfStock} label="Sin stock" />
		</div>
	);
}

function StatRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex items-start justify-between gap-3">
			<dt className="text-muted-foreground shrink-0">{label}</dt>
			<dd className="min-w-0 text-right">{children}</dd>
		</div>
	);
}

function durationBetween(startedAt?: string | null, completedAt?: string | null): number | null {
	if (!startedAt || !completedAt) return null;
	const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
	return Number.isNaN(ms) ? null : ms;
}

/**
 * Rich sync stats shared by the notification detail and the sync report dialog.
 * Shows what the 6 base counters cannot: AI cost, per-item failures, image
 * work, the zeroing guard and blacklist reconciliation.
 */
export function RichSyncStats({
	stats,
	startedAt,
	completedAt,
	failedReasonsLimit = DEFAULT_REASONS_LIMIT,
}: {
	stats: SyncStatsLike;
	startedAt?: string | null;
	completedAt?: string | null;
	failedReasonsLimit?: number;
}) {
	const normalized = normalizeSyncStats(stats);
	const durationMs = normalized.durationMs ?? durationBetween(startedAt, completedAt);
	const reasons = normalized.failedReasons.slice(0, failedReasonsLimit);

	const hasAny =
		normalized.aiCostUsd !== null ||
		normalized.failedCount > 0 ||
		durationMs !== null ||
		normalized.imagesChecked !== null ||
		normalized.zeroingSkipped !== null ||
		(normalized.blacklistedRemoved ?? 0) > 0 ||
		(normalized.unavailableMarked ?? 0) > 0;

	if (!hasAny) return null;

	return (
		<dl className="space-y-2 text-sm">
			{normalized.aiCostUsd !== null && (
				<StatRow label="Costo IA">
					<span className="tabular-nums">US$ {normalized.aiCostUsd.toFixed(4)}</span>
					{normalized.aiCalls !== null && (
						<span className="text-muted-foreground text-xs">
							{" · "}
							{normalized.aiCalls} llamadas
							{normalized.aiFailed ? `, ${normalized.aiFailed} fallidas` : ""}
						</span>
					)}
				</StatRow>
			)}

			{normalized.failedCount > 0 && (
				<StatRow label="Items fallidos">
					<div>
						<span className="tabular-nums">{normalized.failedCount}</span>
						{reasons.length > 0 && (
							<ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
								{reasons.map((reason, index) => (
									<li key={`${index}-${reason}`} className="truncate" title={reason}>
										{reason}
									</li>
								))}
							</ul>
						)}
					</div>
				</StatRow>
			)}

			{durationMs !== null && (
				<StatRow label="Duración">
					<span className="tabular-nums">{formatDurationMs(durationMs)}</span>
				</StatRow>
			)}

			{normalized.imagesChecked !== null && (
				<StatRow label="Imágenes">
					<span className="tabular-nums">
						{normalized.imagesChecked} verificadas · {normalized.imagesMissing ?? 0} faltantes
					</span>
				</StatRow>
			)}

			{normalized.zeroingSkipped !== null && (
				<StatRow label="Barrido sin stock">
					{normalized.zeroingSkipped ? (
						<Badge variant="warning" size="sm">
							Omitido (feed incompleto)
						</Badge>
					) : (
						<Badge variant="success" size="sm">
							Ejecutado
						</Badge>
					)}
				</StatRow>
			)}

			{(normalized.blacklistedRemoved ?? 0) > 0 && (
				<StatRow label="Lista negra">
					<span className="tabular-nums">{normalized.blacklistedRemoved} eliminados</span>
				</StatRow>
			)}

			{(normalized.unavailableMarked ?? 0) > 0 && (
				<StatRow label="No vendibles">
					<span className="tabular-nums">{normalized.unavailableMarked} marcados sin stock</span>
				</StatRow>
			)}
		</dl>
	);
}
