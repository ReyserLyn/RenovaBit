import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { Card } from "@renovabit/ui/components/ui/card";
import { Input } from "@renovabit/ui/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@renovabit/ui/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import {
	getCoreRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import { useDebouncedValue } from "@/shared/lib/hooks/use-debounced-value";
import { recentChangesQueryOptions } from "../hooks/reports-queries";
import type { RecentChange } from "../model";
import { CHANGE_TYPE_OPTIONS } from "../model";
import { getRecentChangesColumns } from "./history-columns";

interface RecentChangesTableProps {
	onProductClick?: (productId: string) => void;
}

const coreRowModel = getCoreRowModel();
const sortedRowModel = getSortedRowModel();

export const RecentChangesTable = React.memo(function RecentChangesTable({
	onProductClick,
}: RecentChangesTableProps) {
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 });
	const [sorting, setSorting] = useState<SortingState>([]);
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);

	// ── Server-side pagination ──────────────────────────

	const { data, isPending, isError, error, refetch } = useQuery(
		recentChangesQueryOptions({
			page: pagination.pageIndex + 1,
			pageSize: pagination.pageSize,
			type: typeFilter !== "all" ? typeFilter : undefined,
			search: debouncedSearch || undefined,
		}),
	);

	const changes = data?.changes ?? [];
	const totalCount = data?.total ?? 0;

	// Resetear a página 1 cuando cambian filtros
	useEffect(() => {
		setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
	}, [debouncedSearch, typeFilter]);

	// Resetear a página 1 cuando cambia el pageSize
	useEffect(() => {
		setPagination((prev) => ({ ...prev, pageIndex: 0 }));
	}, [pagination.pageSize]);

	const columns = useMemo(() => getRecentChangesColumns(), []);

	const table = useReactTable({
		data: changes,
		columns,
		state: { pagination, sorting },
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
		manualPagination: true,
		rowCount: totalCount,
		getCoreRowModel: coreRowModel,
		getSortedRowModel: sortedRowModel,
		enableSorting: true,
		enableSortingRemoval: true,
		getRowId: (row) => row.id,
	});

	const handleRowClick = useCallback(
		(row: RecentChange) => {
			onProductClick?.(row.productId);
		},
		[onProductClick],
	);

	const handleRefresh = useCallback(() => {
		refetch();
	}, [refetch]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1.5">
					<label className="text-muted-foreground text-xs font-medium">Tipo</label>
					<Select
						items={CHANGE_TYPE_OPTIONS}
						value={typeFilter}
						onValueChange={(value) => setTypeFilter(value ?? "all")}
					>
						<SelectTrigger className="h-8 w-[140px]">
							<SelectValue placeholder="Todos" />
						</SelectTrigger>
						<SelectContent>
							{CHANGE_TYPE_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="relative w-full min-w-0 sm:max-w-sm">
					<HugeiconsIcon
						icon={Search01Icon}
						className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						placeholder="Buscar por producto o SKU…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-8 w-full min-w-0 bg-card pl-9"
					/>
				</div>

				{typeFilter !== "all" && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 text-xs"
						onClick={() => setTypeFilter("all")}
					>
						Limpiar tipo
					</Button>
				)}
			</div>

			{isError ? (
				<div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm">
						No se pudieron cargar los cambios.
						{error instanceof Error ? ` ${error.message}` : ""}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8"
						onClick={handleRefresh}
						disabled={isPending}
					>
						Reintentar
					</Button>
				</div>
			) : null}

			<Card className="gap-0 overflow-hidden py-0 shadow-sm">
				<DataGrid
					table={table}
					recordCount={totalCount}
					isLoading={isPending}
					emptyMessage="No se encontraron cambios recientes."
					loadingMessage="Cargando cambios…"
					tableLayout={{
						cellBorder: false,
						rowBorder: true,
						stripped: false,
						headerBackground: true,
						headerBorder: true,
						headerSticky: false,
						width: "fixed",
					}}
					onRowClick={handleRowClick}
				>
					<div className="w-full space-y-2.5">
						<DataGridContainer border={false} className="max-w-full rounded-none border-0">
							<DataGridScrollArea>
								<DataGridTable />
							</DataGridScrollArea>
						</DataGridContainer>

						{totalCount > 0 && (
							<div className="border-border border-t bg-muted/30">
								<DataGridPagination selectionInfo={`${totalCount} cambios`} />
							</div>
						)}
					</div>
				</DataGrid>
			</Card>
		</div>
	);
});
