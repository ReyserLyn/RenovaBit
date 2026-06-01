import { Cancel01Icon, Copy01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useRef, useState } from "react";
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header";
import type { ProductChange, RecentChange } from "../model";
import { CHANGE_LABELS, formatChangeValue } from "../model";

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
	day: "2-digit",
	month: "short",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

function formatDate(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? "—" : dateFormatter.format(d);
}

/** Celda con ID de reporte + botón de copiar + feedback visual */
function ReportIdCell({ id }: { id: string | null }) {
	const [copied, setCopied] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const handleCopy = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (!id) return;

			void navigator.clipboard.writeText(id);
			setCopied(true);
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
			timeoutRef.current = setTimeout(() => setCopied(false), 1500);
		},
		[id],
	);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, []);

	if (!id) return <span className="text-muted-foreground/40 text-xs">—</span>;

	return (
		<div className="flex items-center gap-1 min-w-0">
			<span
				className={[
					"font-mono text-[10px] select-all cursor-default truncate transition-colors duration-200",
					copied ? "text-success" : "text-muted-foreground/60",
				].join(" ")}
				title={id}
			>
				{id}
			</span>
			<Button
				variant="ghost"
				size="icon-xs"
				className={[
					"size-5 shrink-0 transition-colors duration-200",
					copied
						? "text-success hover:text-success"
						: "text-muted-foreground/50 hover:text-foreground",
				].join(" ")}
				onClick={handleCopy}
				aria-label={copied ? "Copiado" : "Copiar ID del reporte"}
				title={copied ? "Copiado" : "Copiar ID"}
			>
				<HugeiconsIcon icon={Copy01Icon} className="size-3!" />
			</Button>
		</div>
	);
}

/** Columnas para el historial de un producto específico */
export function getHistoryColumns(): ColumnDef<ProductChange>[] {
	return [
		{
			accessorKey: "changeType",
			meta: { headerTitle: "Tipo", skeleton: <Skeleton className="h-5 w-20 rounded-full" /> },
			header: ({ column }) => <DataGridColumnHeader column={column} title="Tipo" />,
			cell: ({ row }) => {
				const info = CHANGE_LABELS[row.original.changeType] ?? {
					label: row.original.changeType,
					variant: "info" as const,
				};
				return (
					<Badge variant={info.variant} size="sm">
						{info.label}
					</Badge>
				);
			},
			size: 100,
		},
		{
			id: "details",
			meta: { headerTitle: "Detalle", skeleton: <Skeleton className="h-4 w-48" /> },
			header: ({ column }) => <DataGridColumnHeader column={column} title="Detalle" />,
			cell: ({ row }) => {
				const c = row.original;
				return (
					<div className="flex flex-col">
						{c.reportTrigger && c.reportStartedAt ? (
							<span className="text-xs text-muted-foreground">
								{c.reportTrigger === "manual" ? "Manual" : "Automático"} ·{" "}
								{formatDate(c.reportStartedAt)}
							</span>
						) : (
							<span className="text-xs text-muted-foreground">{c.source}</span>
						)}
						{c.reason && <span className="text-xs text-muted-foreground">{c.reason}</span>}
					</div>
				);
			},
		},
		{
			id: "change",
			meta: { headerTitle: "Cambio", skeleton: <Skeleton className="h-4 w-32" /> },
			header: ({ column }) => <DataGridColumnHeader column={column} title="Cambio" />,
			cell: ({ row }) => {
				const c = row.original;
				if (c.oldValue !== null || c.newValue !== null) {
					return (
						<div className="flex items-center gap-1.5 tabular-nums">
							<span className="text-muted-foreground line-through text-xs">
								{formatChangeValue(c.oldValue, null).split(" → ")[0]}
							</span>
							<HugeiconsIcon
								icon={Cancel01Icon}
								className="size-3 text-muted-foreground rotate-90"
							/>
							<span className="font-medium text-sm">
								{formatChangeValue(null, c.newValue).split(" → ")[1]}
							</span>
						</div>
					);
				}
				return <span className="text-muted-foreground text-xs">{c.reason ?? "—"}</span>;
			},
			size: 220,
		},
		{
			id: "report",
			meta: { headerTitle: "Reporte", skeleton: <Skeleton className="h-4 w-28" /> },
			header: ({ column }) => <DataGridColumnHeader column={column} title="Reporte" />,
			cell: ({ row }) => <ReportIdCell id={row.original.syncReportId} />,
			size: 260,
		},
		{
			accessorKey: "createdAt",
			meta: { headerTitle: "Fecha", skeleton: <Skeleton className="h-4 w-32" /> },
			header: ({ column }) => <DataGridColumnHeader column={column} title="Fecha" />,
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm whitespace-nowrap tabular-nums">
					{formatDate(row.original.createdAt)}
				</span>
			),
			size: 160,
		},
	];
}

/** Columnas para el feed global (incluye columna Producto y Reporte) */
export function getRecentChangesColumns(): ColumnDef<RecentChange>[] {
	return [
		{
			id: "product",
			meta: { headerTitle: "Producto", skeleton: <Skeleton className="h-4 w-40" /> },
			header: ({ column }) => <DataGridColumnHeader column={column} title="Producto" />,
			cell: ({ row }) => (
				<div className="flex flex-col min-w-0">
					<span className="text-sm font-medium truncate">{row.original.productName}</span>
					<span className="text-muted-foreground text-xs">{row.original.productSku}</span>
				</div>
			),
			size: 200,
		},
		{
			accessorKey: "changeType",
			meta: { headerTitle: "Tipo", skeleton: <Skeleton className="h-5 w-20 rounded-full" /> },
			header: ({ column }) => <DataGridColumnHeader column={column} title="Tipo" />,
			cell: ({ row }) => {
				const info = CHANGE_LABELS[row.original.changeType] ?? {
					label: row.original.changeType,
					variant: "info" as const,
				};
				return (
					<Badge variant={info.variant} size="sm">
						{info.label}
					</Badge>
				);
			},
			size: 100,
		},
		{
			id: "change",
			meta: { headerTitle: "Cambio", skeleton: <Skeleton className="h-4 w-32" /> },
			header: ({ column }) => <DataGridColumnHeader column={column} title="Cambio" />,
			cell: ({ row }) => {
				const c = row.original;
				if (c.oldValue !== null || c.newValue !== null) {
					return (
						<div className="flex items-center gap-1.5 tabular-nums">
							<span className="text-muted-foreground line-through text-xs">
								{formatChangeValue(c.oldValue, null).split(" → ")[0]}
							</span>
							<HugeiconsIcon
								icon={Cancel01Icon}
								className="size-3 text-muted-foreground rotate-90"
							/>
							<span className="font-medium text-sm">
								{formatChangeValue(null, c.newValue).split(" → ")[1]}
							</span>
						</div>
					);
				}
				return <span className="text-muted-foreground text-xs">{c.reason ?? "—"}</span>;
			},
			size: 220,
		},
		{
			id: "report",
			meta: { headerTitle: "Reporte", skeleton: <Skeleton className="h-4 w-28" /> },
			header: ({ column }) => <DataGridColumnHeader column={column} title="Reporte" />,
			cell: ({ row }) => <ReportIdCell id={row.original.syncReportId} />,
			size: 260,
		},
		{
			accessorKey: "createdAt",
			meta: { headerTitle: "Fecha", skeleton: <Skeleton className="h-4 w-32" /> },
			header: ({ column }) => <DataGridColumnHeader column={column} title="Fecha" />,
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm whitespace-nowrap tabular-nums">
					{formatDate(row.original.createdAt)}
				</span>
			),
			size: 160,
		},
	];
}
