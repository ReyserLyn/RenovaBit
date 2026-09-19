import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import type { ColumnDef } from "@tanstack/react-table";
import { TriggerBadge } from "@/features/notifications/components/trigger-badge";
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header";
import { formatDateTime } from "@/shared/lib/format-date";
import { formatReportDuration } from "../lib/sync-stats";
import type { SyncReportSummary } from "../model";
import { SyncStatusBadge } from "./sync-status-badge";

export function getSyncReportColumns(): ColumnDef<SyncReportSummary>[] {
	return [
		{
			accessorKey: "status",
			meta: {
				headerTitle: "Estado",
				skeleton: <Skeleton className="h-5 w-20 rounded-full" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Estado" />,
			cell: ({ row }) => <SyncStatusBadge status={row.original.status} />,
			size: 120,
		},
		{
			id: "trigger",
			accessorFn: (row) => row.trigger,
			meta: {
				headerTitle: "Disparo",
				skeleton: <Skeleton className="h-5 w-20 rounded-full" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Disparo" />,
			cell: ({ row }) => <TriggerBadge trigger={row.original.trigger} />,
			size: 110,
		},
		{
			accessorKey: "startedAt",
			meta: {
				headerTitle: "Inicio",
				skeleton: <Skeleton className="h-4 w-32" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Inicio" />,
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm whitespace-nowrap tabular-nums">
					{formatDateTime(row.original.startedAt)}
				</span>
			),
			size: 170,
		},
		{
			accessorKey: "completedAt",
			meta: {
				headerTitle: "Fin",
				skeleton: <Skeleton className="h-4 w-32" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Fin" />,
			cell: ({ row }) =>
				row.original.completedAt ? (
					<span className="text-muted-foreground text-sm whitespace-nowrap tabular-nums">
						{formatDateTime(row.original.completedAt)}
					</span>
				) : (
					<span className="text-info text-sm">En curso</span>
				),
			size: 170,
		},
		{
			id: "duration",
			meta: {
				headerTitle: "Duración",
				skeleton: <Skeleton className="h-4 w-16" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Duración" />,
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm tabular-nums">
					{formatReportDuration(row.original)}
				</span>
			),
			enableSorting: false,
			size: 100,
		},
		{
			id: "summary",
			meta: {
				headerTitle: "Resumen",
				skeleton: <Skeleton className="h-4 w-40" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Resumen" />,
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm whitespace-nowrap tabular-nums">
					{row.original.stats.processed} proc · {row.original.stats.created} nuevos ·{" "}
					{row.original.stats.updated} act · {row.original.stats.errors} err
				</span>
			),
			enableSorting: false,
			size: 230,
		},
		{
			id: "aiCost",
			meta: {
				headerTitle: "Costo IA",
				skeleton: <Skeleton className="h-4 w-20" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Costo IA" />,
			cell: ({ row }) =>
				row.original.stats.aiCostUsd > 0 ? (
					<span className="text-sm tabular-nums">
						US$ {row.original.stats.aiCostUsd.toFixed(4)}
					</span>
				) : (
					<span className="text-muted-foreground text-sm">—</span>
				),
			enableSorting: false,
			size: 110,
		},
		{
			id: "error",
			meta: {
				headerTitle: "Error",
				skeleton: <Skeleton className="h-4 w-40" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Error" />,
			cell: ({ row }) =>
				row.original.errorMessage ? (
					<span
						className="block max-w-[240px] truncate text-destructive text-xs"
						title={row.original.errorMessage}
					>
						{row.original.errorMessage}
					</span>
				) : (
					<span className="text-muted-foreground text-sm">—</span>
				),
			enableSorting: false,
			size: 240,
		},
	];
}
