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
	type RowSelectionState,
	useReactTable,
} from "@tanstack/react-table";
import React, { useEffect, useState } from "react";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridColumnVisibility } from "@/shared/components/data-grid/data-grid-column-visibility";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import { useBrandsTableStore } from "@/shared/lib/stores/tables/brands-table";
import { brandKeys, useBrands, useToggleBrandField } from "../hooks";
import type { Brand } from "../model";
import { BrandBulkDeleteDialog } from "./brand-bulk-delete-dialog";
import { getBrandColumns } from "./brand-column";

interface BrandTableProps {
	onEdit: (brand: Brand) => void;
	onDelete: (brand: Brand) => void;
}

const EMPTY_BRANDS: Brand[] = [];

export const BrandTable = React.memo(function BrandTable({ onEdit, onDelete }: BrandTableProps) {
	const queryClient = useQueryClient();
	const { data: brandsData, isPending, isFetching, isError, error } = useBrands();
	const brands = brandsData ?? EMPTY_BRANDS;
	const toggleBrandField = useToggleBrandField();

	function handleRefresh() {
		void queryClient.invalidateQueries({ queryKey: brandKeys.all });
	}

	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10,
	});
	const sorting = useBrandsTableStore((s) => s.sorting);
	const setSorting = useBrandsTableStore((s) => s.setSorting);
	const columnVisibility = useBrandsTableStore((s) => s.columnVisibility);
	const setColumnVisibility = useBrandsTableStore((s) => s.setColumnVisibility);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

	async function handleToggleStatus(brand: Brand, isActive: boolean) {
		await toggleBrandField.mutateAsync({ id: brand.id, data: { isActive } });
	}

	async function handleToggleFeatured(brand: Brand, isFeatured: boolean) {
		await toggleBrandField.mutateAsync({ id: brand.id, data: { isFeatured } });
	}

	const columns = getBrandColumns({
		onEdit,
		onDelete,
		onToggleStatus: handleToggleStatus,
		onToggleFeatured: handleToggleFeatured,
	});

	const table = useReactTable({
		data: brands,
		columns,
		state: {
			pagination,
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
		},
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		enableRowSelection: true,
		getRowId: (row) => row.id,
	});

	useEffect(() => {
		const validIds = new Set(brands.map((brand) => brand.id));
		const currentSelection = table.getState().rowSelection;
		const hasOrphanSelection = Object.keys(currentSelection).some((id) => !validIds.has(id));

		if (!hasOrphanSelection) {
			return;
		}

		table.setRowSelection((prev) => {
			const next: RowSelectionState = {};
			for (const [id, selected] of Object.entries(prev)) {
				if (selected && validIds.has(id)) {
					next[id] = true;
				}
			}
			return next;
		});
	}, [brands, table]);

	useEffect(() => {
		setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
	}, [columnFilters]);

	const filteredCount = table.getFilteredRowModel().rows.length;
	const selectedRows = table.getFilteredSelectedRowModel().rows;
	const selectedBrands = selectedRows.map((row) => row.original);
	const selectedCount = selectedBrands.length;
	const selectionInfo = `${selectedCount} de ${filteredCount} filas seleccionadas`;

	return (
		<div className="flex flex-col gap-4">
			{isError ? (
				<div className="bg-destructive/5 border-destructive/40 flex flex-col items-start gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm">
						No se pudieron cargar las marcas.
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
						placeholder="Filtrar marcas por nombre…"
						value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
						onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
						className="w-full min-w-0 bg-card pl-9"
					/>
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2 sm:ms-auto">
					<BrandBulkDeleteDialog selectedBrands={selectedBrands} />
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
					emptyMessage="No se encontraron marcas."
					loadingMessage="Cargando marcas…"
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
								<DataGridPagination selectionInfo={selectionInfo} />
							</div>
						) : null}
					</div>
				</DataGrid>
			</Card>
		</div>
	);
});
