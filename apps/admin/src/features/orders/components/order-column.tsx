import {
	Cancel01Icon,
	EyeIcon,
	MoneyReceive01Icon,
	MoreHorizontalIcon,
	ShoppingCartCheck02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import { Checkbox } from "@renovabit/ui/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@renovabit/ui/components/ui/dropdown-menu";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header";
import { formatCurrency, formatShortDate } from "../lib/format";
import {
	ORDER_STATUS_CONFIG,
	type OrderListItem,
	type OrderStatus,
	SOURCE_LABELS,
	VALID_STATUS_TRANSITIONS,
} from "../model";

// ── Column Props ────────────────────────────────────────

interface OrderColumnsProps {
	onViewDetail: (order: OrderListItem) => void;
	onStatusChange: (order: OrderListItem, newStatus: OrderStatus) => void;
}

// ── Columns ─────────────────────────────────────────────

export function getOrderColumns({
	onViewDetail,
	onStatusChange,
}: OrderColumnsProps): ColumnDef<OrderListItem>[] {
	return [
		{
			id: "select",
			meta: {
				headerTitle: "Selección",
				skeleton: <Skeleton className="size-4 rounded-sm" />,
			},
			header: ({ table }) => {
				const isAllSelected = table.getIsAllPageRowsSelected();
				const isSomeSelected = table.getIsSomePageRowsSelected();

				return (
					<Checkbox
						checked={isAllSelected}
						data-state={isSomeSelected ? "indeterminate" : undefined}
						onCheckedChange={(value: boolean | "indeterminate") =>
							table.toggleAllPageRowsSelected(value === true)
						}
						aria-label="Seleccionar todas las filas"
					/>
				);
			},
			cell: ({ row }) => (
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value: boolean | "indeterminate") => row.toggleSelected(value === true)}
					aria-label="Seleccionar fila"
				/>
			),
			enableSorting: false,
			enableHiding: false,
			size: 40,
		},
		{
			accessorKey: "orderNumber",
			meta: {
				headerTitle: "Pedido",
				skeleton: <Skeleton className="h-4 w-[min(100%,12rem)]" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Pedido" />,
			cell: ({ row }) => (
				<span className="font-mono text-sm font-medium">{row.original.orderNumber}</span>
			),
			enableSorting: false,
		},
		{
			accessorKey: "customerName",
			meta: {
				headerTitle: "Cliente",
				skeleton: <Skeleton className="h-4 w-[min(100%,10rem)]" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Cliente" />,
			cell: ({ row }) => {
				const name = row.original.customerName;
				return <span className={name ? "" : "text-muted-foreground"}>{name || "—"}</span>;
			},
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
				const config = ORDER_STATUS_CONFIG[status];
				return <Badge variant={config?.variant ?? "secondary"}>{config?.label ?? status}</Badge>;
			},
			enableSorting: false,
		},
		{
			accessorKey: "itemsCount",
			meta: {
				headerTitle: "Productos",
				skeleton: <Skeleton className="h-4 w-10 tabular-nums" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Productos" />,
			cell: ({ row }) => <span className="tabular-nums">{row.original.itemsCount}</span>,
			enableSorting: false,
			size: 90,
		},
		{
			accessorKey: "total",
			meta: {
				headerTitle: "Total",
				skeleton: <Skeleton className="h-4 w-24 tabular-nums" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Total" />,
			cell: ({ row }) => (
				<span className="tabular-nums font-medium">{formatCurrency(row.original.total)}</span>
			),
			enableSorting: false,
		},
		{
			accessorKey: "source",
			meta: {
				headerTitle: "Origen",
				skeleton: <Skeleton className="h-4 w-16" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Origen" />,
			cell: ({ row }) => {
				const source = row.original.source;
				return (
					<span className="text-muted-foreground text-sm">{SOURCE_LABELS[source] ?? source}</span>
				);
			},
			enableSorting: false,
			size: 80,
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
			cell: ({ row }) => {
				const order = row.original;
				const transitions = VALID_STATUS_TRANSITIONS[order.status] ?? [];

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
							<DropdownMenuItem onClick={() => onViewDetail(order)}>
								<HugeiconsIcon icon={EyeIcon} className="mr-2 size-4" />
								Ver detalle
							</DropdownMenuItem>
							{transitions.length > 0 && (
								<>
									<DropdownMenuSeparator />
									{transitions.includes("confirmed") && (
										<DropdownMenuItem onClick={() => onStatusChange(order, "confirmed")}>
											<HugeiconsIcon
												icon={ShoppingCartCheck02Icon}
												className="mr-2 size-4 text-green-600"
											/>
											Confirmar pedido
										</DropdownMenuItem>
									)}
									{transitions.includes("cancelled") && (
										<DropdownMenuItem
											onClick={() => onStatusChange(order, "cancelled")}
											className="text-destructive focus:text-destructive"
										>
											<HugeiconsIcon icon={Cancel01Icon} className="mr-2 size-4" />
											Cancelar pedido
										</DropdownMenuItem>
									)}
									{transitions.includes("refunded") && (
										<DropdownMenuItem onClick={() => onStatusChange(order, "refunded")}>
											<HugeiconsIcon
												icon={MoneyReceive01Icon}
												className="mr-2 size-4 text-blue-600"
											/>
											Reembolsar pedido
										</DropdownMenuItem>
									)}
								</>
							)}
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
