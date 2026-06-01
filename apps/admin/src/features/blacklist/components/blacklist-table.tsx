import { ReloadIcon, Search01Icon, Settings02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { Card } from "@renovabit/ui/components/ui/card";
import { Input } from "@renovabit/ui/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import {
	type ColumnFiltersState,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	useReactTable,
} from "@tanstack/react-table";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridColumnVisibility } from "@/shared/components/data-grid/data-grid-column-visibility";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import { useBlacklistTableStore } from "@/shared/lib/stores/tables/blacklist-table";
import { blacklistKeys, useBlacklist } from "../hooks";
import type { BlacklistEntry } from "../model";
import { getBlacklistColumns } from "./blacklist-column";

interface BlacklistTableProps {
	onRevert: (entry: BlacklistEntry) => void;
}

const EMPTY_LIST: BlacklistEntry[] = [];

// Stable row models — created ONCE, never recreated
const coreRowModel = getCoreRowModel();
const filteredRowModel = getFilteredRowModel();
const sortedRowModel = getSortedRowModel();
const paginationRowModel = getPaginationRowModel();

export const BlacklistTable = React.memo(function BlacklistTable({
	onRevert,
}: BlacklistTableProps) {
	const queryClient = useQueryClient();
	const { data: blacklistData, isPending, isFetching, isError, error } = useBlacklist();
	const entries = blacklistData ?? EMPTY_LIST;

	// Stable refresh handler
	const handleRefresh = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: blacklistKeys.all });
	}, [queryClient]);

	// Stabilize columns array to prevent table re-initialization
	const columns = useMemo(() => getBlacklistColumns({ onRevert }), [onRevert]);

	const sorting = useBlacklistTableStore((s) => s.sorting);
	const setSorting = useBlacklistTableStore((s) => s.setSorting);
	const columnVisibility = useBlacklistTableStore((s) => s.columnVisibility);
	const setColumnVisibility = useBlacklistTableStore((s) => s.setColumnVisibility);
	const [pagination, setPagination] = useState<PaginationState>(() => ({
		pageIndex: 0,
		pageSize: 10,
	}));
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

	const table = useReactTable({
		data: entries,
		columns,
		state: {
			pagination,
			sorting,
			columnFilters,
			columnVisibility,
		},
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		getCoreRowModel: coreRowModel,
		getFilteredRowModel: filteredRowModel,
		getSortedRowModel: sortedRowModel,
		getPaginationRowModel: paginationRowModel,
		getRowId: (row) => row.id,
	});

	// Resetear paginación cuando cambian los filtros
	useEffect(() => {
		setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
	}, [columnFilters]);

	const filteredCount = table.getFilteredRowModel().rows.length;

	// Custom filter: busca en externalId, productName, source y reason
	const filterValue = (table.getColumn("externalId")?.getFilterValue() as string) ?? "";

	return (
		<div className="flex flex-col gap-4">
			{isError ? (
				<div className="bg-destructive/5 border-destructive/40 flex flex-col items-start gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm">
						No se pudieron cargar las entradas de la lista negra.
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

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="relative w-full min-w-0 sm:max-w-md">
					<HugeiconsIcon
						icon={Search01Icon}
						className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						placeholder="Filtrar por ID, producto, origen o motivo…"
						value={filterValue}
						onChange={(event) => table.getColumn("externalId")?.setFilterValue(event.target.value)}
						className="w-full min-w-0 bg-card pl-9"
					/>
				</div>
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
			</div>

			<Card className="gap-0 overflow-hidden py-0 shadow-sm">
				<DataGrid
					table={table}
					recordCount={filteredCount}
					isLoading={isPending}
					emptyMessage="No hay ID bloqueados en la lista negra."
					loadingMessage="Cargando lista negra…"
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
});
