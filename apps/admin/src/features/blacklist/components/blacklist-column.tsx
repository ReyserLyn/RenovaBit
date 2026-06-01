import { MoreHorizontalIcon, UndoIcon } from "@hugeicons/core-free-icons";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@renovabit/ui/components/ui/tooltip";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header";
import { formatShortDateTime } from "@/shared/lib/format-date";
import type { BlacklistEntry } from "../model";

interface BlacklistColumnHandlers {
	onRevert: (entry: BlacklistEntry) => void;
}

export function getBlacklistColumns({
	onRevert,
}: BlacklistColumnHandlers): ColumnDef<BlacklistEntry>[] {
	return [
		{
			accessorKey: "externalId",
			meta: {
				headerTitle: "ID Proveedor",
				skeleton: <Skeleton className="h-4 w-28 font-mono" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="ID Proveedor" />,
			cell: ({ row }) => (
				<span className="font-mono text-sm truncate max-w-[180px] block">
					{row.original.externalId}
				</span>
			),
		},
		{
			accessorKey: "productName",
			meta: {
				headerTitle: "Producto",
				skeleton: <Skeleton className="h-4 w-36" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Producto" />,
			cell: ({ row }) => {
				const name = row.getValue<string | null>("productName");
				if (!name) return <span className="text-muted-foreground text-sm">—</span>;
				return (
					<Tooltip>
						<TooltipTrigger
							render={
								<span className="text-sm truncate max-w-[200px] block hover:cursor-help">
									{name}
								</span>
							}
						/>
						<TooltipContent className="max-w-sm">{name}</TooltipContent>
					</Tooltip>
				);
			},
		},
		{
			accessorKey: "source",
			meta: {
				headerTitle: "Origen",
				skeleton: <Skeleton className="h-5 w-20 rounded-full" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Origen" />,
			cell: ({ row }) => (
				<Badge variant="secondary" className="font-mono text-xs">
					{row.original.source}
				</Badge>
			),
			size: 110,
		},
		{
			accessorKey: "reason",
			meta: {
				headerTitle: "Motivo",
				skeleton: <Skeleton className="h-4 w-40" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Motivo" />,
			cell: ({ row }) => {
				const reason = row.getValue<string | null>("reason");
				if (!reason) return <span className="text-muted-foreground text-sm">—</span>;
				return (
					<Tooltip>
						<TooltipTrigger
							render={
								<span className="text-muted-foreground text-sm truncate max-w-[220px] block cursor-help">
									{reason}
								</span>
							}
						/>
						<TooltipContent className="max-w-sm">{reason}</TooltipContent>
					</Tooltip>
				);
			},
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
					{formatShortDateTime(row.original.createdAt)}
				</span>
			),
			size: 140,
		},
		{
			id: "actions",
			meta: {
				headerTitle: "Acciones",
				skeleton: <Skeleton className="mx-auto size-8 rounded-md" />,
			},
			header: () => null,
			cell: ({ row }) => {
				const entry = row.original;

				return (
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
							<DropdownMenuItem onClick={() => onRevert(entry)}>
								<HugeiconsIcon icon={UndoIcon} className="mr-2 size-4" />
								Revertir
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				);
			},
			enableSorting: false,
			enableHiding: false,
			size: 50,
		},
	];
}
