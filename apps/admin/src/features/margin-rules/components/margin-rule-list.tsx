import {
	Delete01Icon,
	Edit01Icon,
	MoreHorizontalIcon,
	ReloadIcon,
	Settings02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import { Card } from "@renovabit/ui/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@renovabit/ui/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import {
	type ColumnDef,
	getCoreRowModel,
	getPaginationRowModel,
	type PaginationState,
	useReactTable,
} from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridColumnVisibility } from "@/shared/components/data-grid/data-grid-column-visibility";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import { marginRuleKeys, useMarginRules } from "../hooks";
import type { MarginRule } from "../service/margin-rules.service";

// ── Core row models ──

const coreRowModel = getCoreRowModel();
const paginationRowModel = getPaginationRowModel();

// ── Props ────────────────────────────────────────────────

interface MarginRuleListProps {
	onEdit: (rule: MarginRule) => void;
	onDelete: (rule: MarginRule) => void;
}

// ── Columns ──────────────────────────────────────────────

function getColumns(props: {
	onEdit: (rule: MarginRule) => void;
	onDelete: (rule: MarginRule) => void;
}): ColumnDef<MarginRule>[] {
	return [
		{ accessorKey: "name", header: "Nombre" },
		{
			accessorKey: "minPrice",
			header: "Precio min.",
			cell: ({ row }) => (
				<span className="font-mono tabular-nums text-sm">S/ {row.original.minPrice}</span>
			),
		},
		{
			accessorKey: "maxPrice",
			header: "Precio máx.",
			cell: ({ row }) => (
				<span className="font-mono tabular-nums text-sm">
					{row.original.maxPrice ? `S/ ${row.original.maxPrice}` : "∞"}
				</span>
			),
		},
		{
			accessorKey: "customerPct",
			header: "Margen cliente",
			cell: ({ row }) => (
				<Badge variant="secondary" size="xs" className="font-mono">
					{row.original.customerPct}%
				</Badge>
			),
		},
		{
			accessorKey: "distributorPct",
			header: "Margen distribuidor",
			cell: ({ row }) => (
				<Badge variant="outline" size="xs" className="font-mono">
					{row.original.distributorPct}%
				</Badge>
			),
		},
		{
			accessorKey: "sortOrder",
			header: "Orden",
			cell: ({ row }) => (
				<span className="font-mono tabular-nums text-sm">{row.original.sortOrder}</span>
			),
		},
		{
			id: "actions",
			meta: { headerTitle: "Acciones" },
			header: () => null,
			cell: ({ row }) => {
				const rule = row.original;
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
							<DropdownMenuItem onClick={() => props.onEdit(rule)}>
								<HugeiconsIcon icon={Edit01Icon} className="mr-2 size-4" />
								Editar
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => props.onDelete(rule)}
								className="text-destructive focus:text-destructive"
							>
								<HugeiconsIcon icon={Delete01Icon} className="mr-2 size-4" />
								Eliminar
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

// ── Component ────────────────────────────────────────────

export function MarginRuleList({ onEdit, onDelete }: MarginRuleListProps) {
	const queryClient = useQueryClient();
	const { data: rulesData, isPending, isFetching, isError, error } = useMarginRules();
	const rules = rulesData ?? [];

	const columns = useMemo(() => getColumns({ onEdit, onDelete }), [onEdit, onDelete]);

	const [pagination, setPagination] = useState<PaginationState>(() => ({
		pageIndex: 0,
		pageSize: 10,
	}));

	const table = useReactTable({
		data: rules,
		columns,
		state: { pagination },
		onPaginationChange: setPagination,
		getCoreRowModel: coreRowModel,
		getPaginationRowModel: paginationRowModel,
		getRowId: (row) => row.id,
	});

	const handleRefresh = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: marginRuleKeys.all });
	}, [queryClient]);

	const filteredCount = table.getFilteredRowModel().rows.length;

	return (
		<div className="flex flex-col gap-4">
			{isError ? (
				<div className="bg-destructive/5 border-destructive/40 flex flex-col items-start gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm">
						No se pudieron cargar las reglas de margen.
						{error instanceof Error ? ` ${error.message}` : ""}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8"
						onClick={handleRefresh}
						disabled={isFetching}
					>
						Reintentar
					</Button>
				</div>
			) : null}

			<div className="flex shrink-0 flex-wrap items-center gap-2 sm:ms-auto">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-8 bg-card"
					onClick={handleRefresh}
					disabled={isFetching}
				>
					<HugeiconsIcon
						icon={ReloadIcon}
						className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
					/>
					Refrescar
				</Button>
				<DataGridColumnVisibility
					table={table}
					trigger={
						<Button variant="outline" size="sm" className="h-8 bg-card">
							<HugeiconsIcon icon={Settings02Icon} className="mr-2 h-4 w-4" />
							Ver columnas
						</Button>
					}
				/>
			</div>

			<Card className="gap-0 overflow-hidden py-0 shadow-sm">
				<DataGrid
					table={table}
					recordCount={filteredCount}
					isLoading={isPending}
					emptyMessage="No hay reglas de margen. Crea la primera regla para empezar."
					loadingMessage="Cargando reglas de margen…"
					tableLayout={{
						cellBorder: false,
						rowBorder: true,
						stripped: true,
						headerBackground: true,
						headerBorder: true,
						headerSticky: false,
						width: "fixed",
					}}
				>
					<div className="w-full space-y-2.5">
						<DataGridContainer border={false} className="max-w-full rounded-none border-0">
							<DataGridScrollArea>
								<DataGridTable />
							</DataGridScrollArea>
						</DataGridContainer>

						{!isPending && filteredCount > 0 ? (
							<div className="border-border border-t bg-muted/30">
								<DataGridPagination />
							</div>
						) : null}
					</div>
				</DataGrid>
			</Card>
		</div>
	);
}
