import { ReloadIcon, Search01Icon, Settings02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { Card } from "@renovabit/ui/components/ui/card";
import { Input } from "@renovabit/ui/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import {
	type ColumnDef,
	type ColumnFiltersState,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type RowSelectionState,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useBrands } from "@/features/brands/hooks";
import { useCategories } from "@/features/categories/hooks";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridColumnVisibility } from "@/shared/components/data-grid/data-grid-column-visibility";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import { useProductsTableStore } from "@/shared/lib/stores/tables/products-table";
import { productKeys, useProducts, useUpdateProduct } from "../hooks";
import type { Product, ProductStatus } from "../model";
import { ProductBulkDeleteDialog } from "./product-bulk-delete-dialog";
import { getProductColumns } from "./product-column";

interface ProductTableProps {
	onEdit: (product: Product) => void;
	onDelete: (product: Product) => void;
}

const EMPTY_PRODUCTS: Product[] = [];

export const ProductTable = React.memo(function ProductTable({
	onEdit,
	onDelete,
}: ProductTableProps) {
	const queryClient = useQueryClient();
	const { data: productsData, isPending, isFetching, isError, error } = useProducts();
	const products = productsData ?? EMPTY_PRODUCTS;
	const updateProduct = useUpdateProduct();

	const { data: brandsData } = useBrands();
	const { data: categoriesData } = useCategories();

	const brandsById = useMemo(() => new Map((brandsData ?? []).map((b) => [b.id, b])), [brandsData]);
	const categoriesById = useMemo(
		() => new Map((categoriesData ?? []).map((c) => [c.id, c])),
		[categoriesData],
	);

	const handleRefresh = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: productKeys.all });
	}, [queryClient]);

	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10,
	});
	const sorting = useProductsTableStore((s) => s.sorting);
	const setSorting = useProductsTableStore((s) => s.setSorting);
	const columnVisibility = useProductsTableStore((s) => s.columnVisibility);
	const setColumnVisibility = useProductsTableStore((s) => s.setColumnVisibility);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

	const handleToggleStatus = useCallback(
		async (product: Product, status: ProductStatus) => {
			await updateProduct.mutateAsync({ id: product.id, data: { status } });
		},
		[updateProduct],
	);

	const handleToggleFeatured = useCallback(
		async (product: Product, isFeatured: boolean) => {
			await updateProduct.mutateAsync({ id: product.id, data: { isFeatured } });
		},
		[updateProduct],
	);

	const columns = useMemo(
		() =>
			getProductColumns({
				onEdit,
				onDelete,
				onToggleStatus: handleToggleStatus,
				onToggleFeatured: handleToggleFeatured,
				brandsById,
				categoriesById,
			}),
		[onEdit, onDelete, handleToggleStatus, handleToggleFeatured, brandsById, categoriesById],
	);

	const table = useReactTable({
		data: products,
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
		const validIds = new Set(products.map((product) => product.id));
		const currentSelection = table.getState().rowSelection;
		const hasOrphanSelection = Object.keys(currentSelection).some((id) => !validIds.has(id));

		if (!hasOrphanSelection) return;

		table.setRowSelection((prev) => {
			const next: RowSelectionState = {};
			for (const [id, selected] of Object.entries(prev)) {
				if (selected && validIds.has(id)) {
					next[id] = true;
				}
			}
			return next;
		});
	}, [products, table]);

	useEffect(() => {
		setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
	}, [columnFilters]);

	const filteredCount = table.getFilteredRowModel().rows.length;
	const selectedRows = table.getFilteredSelectedRowModel().rows;
	const selectedProducts = selectedRows.map((row) => row.original);
	const selectedCount = selectedProducts.length;
	const selectionInfo = `${selectedCount} de ${filteredCount} filas seleccionadas`;

	return (
		<div className="flex flex-col gap-4">
			{isError ? (
				<div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm">
						No se pudieron cargar los productos.
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
						placeholder="Filtrar productos por nombre…"
						value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
						onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
						className="w-full min-w-0 bg-card pl-9"
					/>
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2 sm:ms-auto">
					<ProductBulkDeleteDialog selectedProducts={selectedProducts} />
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
					emptyMessage="No se encontraron productos."
					loadingMessage="Cargando productos…"
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
							<div className="border-t border-border bg-muted/30">
								<DataGridPagination selectionInfo={selectionInfo} />
							</div>
						) : null}
					</div>
				</DataGrid>
			</Card>
		</div>
	);
});
