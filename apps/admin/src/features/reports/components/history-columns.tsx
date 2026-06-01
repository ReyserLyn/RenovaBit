import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header";
import type { ProductChange } from "../service/reports.service";

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

const CHANGE_LABELS: Record<
	string,
	{ label: string; variant: "success" | "warning" | "info" | "destructive" }
> = {
	created: { label: "Creado", variant: "success" },
	price_changed: { label: "Precio", variant: "warning" },
	stock_changed: { label: "Stock", variant: "info" },
	out_of_stock: { label: "Sin stock", variant: "destructive" },
};

function formatOldNew(oldVal: unknown, newVal: unknown, changeType: string): string {
	const fmt = (v: unknown) => {
		if (v === null || v === undefined) return "—";
		if (typeof v === "object") {
			const o = v as Record<string, unknown>;
			if ("price" in o) return `S/ ${o.price}`;
			if ("stock" in o) return String(o.stock);
			return JSON.stringify(o);
		}
		return String(v);
	};
	return `${fmt(oldVal)} → ${fmt(newVal)}`;
}

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
								{formatOldNew(c.oldValue, null, c.changeType).split(" → ")[0]}
							</span>
							<HugeiconsIcon
								icon={Cancel01Icon}
								className="size-3 text-muted-foreground rotate-90"
							/>
							<span className="font-medium text-sm">
								{formatOldNew(null, c.newValue, c.changeType).split(" → ")[1]}
							</span>
						</div>
					);
				}
				return <span className="text-muted-foreground text-xs">{c.reason ?? "—"}</span>;
			},
			size: 200,
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
