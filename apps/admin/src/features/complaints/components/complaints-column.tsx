import { EyeIcon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@renovabit/ui/components/ui/dropdown-menu";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header";
import { formatShortDate } from "../lib/format";
import { COMPLAINT_STATUS_CONFIG, COMPLAINT_TYPE_LABELS, type ComplaintListItem } from "../model";

// ── Column Props ────────────────────────────────────────

interface ComplaintColumnsProps {
	onViewDetail: (complaint: ComplaintListItem) => void;
}

// ── Columns ─────────────────────────────────────────────

export function getComplaintColumns({
	onViewDetail,
}: ComplaintColumnsProps): ColumnDef<ComplaintListItem>[] {
	return [
		{
			accessorKey: "code",
			meta: {
				headerTitle: "Código",
				skeleton: <Skeleton className="h-4 w-[min(100%,8rem)]" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Código" />,
			cell: ({ row }) => <span className="font-mono text-sm font-medium">{row.original.code}</span>,
			enableSorting: false,
		},
		{
			accessorKey: "type",
			meta: {
				headerTitle: "Tipo",
				skeleton: <Skeleton className="h-5 w-16 rounded-full" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Tipo" />,
			cell: ({ row }) => (
				<Badge variant="outline">{COMPLAINT_TYPE_LABELS[row.original.type]}</Badge>
			),
			enableSorting: false,
			size: 100,
		},
		{
			accessorKey: "fullName",
			meta: {
				headerTitle: "Reclamante",
				skeleton: <Skeleton className="h-4 w-[min(100%,12rem)]" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Reclamante" />,
			cell: ({ row }) => <span>{row.original.fullName}</span>,
			enableSorting: false,
		},
		{
			accessorKey: "docNumber",
			meta: {
				headerTitle: "Documento",
				skeleton: <Skeleton className="h-4 w-[min(100%,9rem)]" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Documento" />,
			cell: ({ row }) => (
				<span className="flex items-center gap-1.5">
					<span className="text-muted-foreground text-xs">{row.original.docType}</span>
					<span className="font-mono text-sm">{row.original.docNumber}</span>
				</span>
			),
			enableSorting: false,
		},
		{
			accessorKey: "status",
			meta: {
				headerTitle: "Estado",
				skeleton: <Skeleton className="h-5 w-20 rounded-full" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Estado" />,
			cell: ({ row }) => {
				const status = row.original.status;
				const config = COMPLAINT_STATUS_CONFIG[status];
				return <Badge variant={config?.variant ?? "secondary"}>{config?.label ?? status}</Badge>;
			},
			enableSorting: false,
			size: 120,
		},
		{
			accessorKey: "createdAt",
			meta: {
				headerTitle: "Fecha",
				skeleton: <Skeleton className="h-4 w-28 tabular-nums" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Fecha" />,
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm tabular-nums">
					{formatShortDate(row.original.createdAt)}
				</span>
			),
			enableSorting: false,
			size: 140,
		},
		{
			id: "actions",
			meta: {
				headerTitle: "Acciones",
				skeleton: <Skeleton className="mx-auto size-8 rounded-md" />,
			},
			header: () => null,
			cell: ({ row }) => (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button variant="ghost" size="icon-sm" className="h-8 w-8">
								<span className="sr-only">Abrir menú</span>
								<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
							</Button>
						}
					/>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => onViewDetail(row.original)}>
							<HugeiconsIcon icon={EyeIcon} className="mr-2 size-4" />
							Ver detalle
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			),
			enableSorting: false,
			enableHiding: false,
			size: 50,
		},
	];
}
