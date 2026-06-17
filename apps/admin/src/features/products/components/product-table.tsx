import { Cancel01Icon, ReloadIcon, Search01Icon, Settings02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import { Card } from "@renovabit/ui/components/ui/card";
import { Input } from "@renovabit/ui/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@renovabit/ui/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import {
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type RowSelectionState,
	useReactTable,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBrands } from "@/features/brands/hooks";
import { useCategories } from "@/features/categories/hooks";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridColumnVisibility } from "@/shared/components/data-grid/data-grid-column-visibility";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import { useProductsTableStore } from "@/shared/lib/stores/tables/products-table";
import { productKeys, useProducts, useToggleProductField } from "../hooks";
import { useProductTableFilters } from "../hooks/use-product-table-filters";
import type { Product } from "../model";
import { ProductBulkDeleteDialog } from "./product-bulk-delete-dialog";
import { getProductColumns } from "./product-column";

// ── Constants ──────────────────────────────────────

interface ProductTableProps {
	onEdit: (product: Product) => void;
	onDelete: (product: Product) => void;
	onHistory: (product: Product) => void;
	onBlacklist: (product: Product) => void;
}

const EMPTY_PRODUCTS: Product[] = [];

// Stable row models — created ONCE, never recreated
const coreRowModel = getCoreRowModel();
const filteredRowModel = getFilteredRowModel();
const sortedRowModel = getSortedRowModel();
const paginationRowModel = getPaginationRowModel();

// ── Component ──────────────────────────────────────

export const ProductTable = function ProductTable({
	onEdit,
	onDelete,
	onHistory,
	onBlacklist,
}: ProductTableProps) {
	const queryClient = useQueryClient();
	const { data: productsData, isPending, isFetching, isError, error } = useProducts();
	const products = productsData ?? EMPTY_PRODUCTS;
	const toggleProductField = useToggleProductField();

	const { data: brandsData } = useBrands();
	const { data: categoriesData } = useCategories();

	// Build lookup Maps for O(1) access (js-index-maps)
	const brandsById = useMemo(() => new Map((brandsData ?? []).map((b) => [b.id, b])), [brandsData]);
	const brandsBySlug = useMemo(
		() => new Map((brandsData ?? []).map((b) => [b.slug, b])),
		[brandsData],
	);
	const categoriesById = useMemo(
		() => new Map((categoriesData ?? []).map((c) => [c.id, c])),
		[categoriesData],
	);
	const categoriesBySlug = useMemo(
		() => new Map((categoriesData ?? []).map((c) => [c.slug, c])),
		[categoriesData],
	);

	// ── Filters (extracted hook) ────────────────────

	const {
		filters,
		localSearch,
		handleSearchChange,
		handleBrandChange,
		handleCategoryChange,
		handleStatusChange,
		handleClearFilters,
		handleRemoveBrandFilter,
		handleRemoveCategoryFilter,
		handleRemoveStatusFilter,
		columnFilters,
		setColumnFilters,
		brandLabel,
		categoryLabel,
		statusLabel,
		hasActiveFilters,
	} = useProductTableFilters(brandsBySlug, categoriesBySlug);

	// ── Stable handlers ──────────────────────────────

	const handleRefresh = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: productKeys.all });
		void queryClient.invalidateQueries({ queryKey: ["brands"] });
		void queryClient.invalidateQueries({ queryKey: ["categories"] });
	}, [queryClient]);

	const handleToggleStatus = useCallback(
		async (product: Product, isActive: boolean) => {
			await toggleProductField.mutateAsync({
				id: product.id,
				data: { isActive },
			});
		},
		[toggleProductField],
	);

	const handleToggleFeatured = useCallback(
		async (product: Product, isFeatured: boolean) => {
			await toggleProductField.mutateAsync({
				id: product.id,
				data: { isFeatured },
			});
		},
		[toggleProductField],
	);

	// ── Table state ──────────────────────────────────

	const [pagination, setPagination] = useState<PaginationState>(() => ({
		pageIndex: 0,
		pageSize: 10,
	}));
	const sorting = useProductsTableStore((s) => s.sorting);
	const setSorting = useProductsTableStore((s) => s.setSorting);
	const columnVisibility = useProductsTableStore((s) => s.columnVisibility);
	const setColumnVisibility = useProductsTableStore((s) => s.setColumnVisibility);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

	// ── Columns ──────────────────────────────────────

	const columns = useMemo(
		() =>
			getProductColumns({
				onEdit,
				onDelete,
				onToggleStatus: handleToggleStatus,
				onToggleFeatured: handleToggleFeatured,
				onHistory,
				onBlacklist,
				brandsById,
				categoriesById,
			}),
		[
			onEdit,
			onDelete,
			handleToggleStatus,
			handleToggleFeatured,
			onHistory,
			onBlacklist,
			brandsById,
			categoriesById,
		],
	);

	// ── Table instance ───────────────────────────────

	const table = useReactTable({
		data: products,
		columns,
		state: {
			pagination,
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
			globalFilter: filters.search,
		},
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		onGlobalFilterChange: filters.setSearch,
		globalFilterFn: (row, _, filterValue) => {
			const search = String(filterValue).toLowerCase().trim();
			if (!search) return true;
			const { name, sku, slug } = row.original;
			return (
				String(name).toLowerCase().includes(search) ||
				String(sku).toLowerCase().includes(search) ||
				String(slug ?? "")
					.toLowerCase()
					.includes(search)
			);
		},
		getCoreRowModel: coreRowModel,
		getFilteredRowModel: filteredRowModel,
		getSortedRowModel: sortedRowModel,
		getPaginationRowModel: paginationRowModel,
		enableRowSelection: true,
		getRowId: (row) => row.id,
	});

	// Orphan selection cleanup: remove selections for deleted/filtered products
	useEffect(() => {
		const validIds = new Set(products.map((p) => p.id));
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

	// Reset pagination when filters change
	useEffect(() => {
		setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
	}, []);

	// ── Derived values (rerender-derived-state-no-effect) ──

	const filteredCount = table.getFilteredRowModel().rows.length;
	const selectedRows = table.getFilteredSelectedRowModel().rows;
	const selectedProducts = selectedRows.map((row) => row.original);
	const selectedCount = selectedProducts.length;
	const selectionInfo = `${selectedCount} de ${filteredCount} filas seleccionadas`;

	// ── Render ───────────────────────────────────────

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

			{/* ── Filters ──────────────────────────── */}
			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1.5">
					<label className="text-muted-foreground text-xs font-medium">Marca</label>
					<Select value={filters.brandSlug ?? "all"} onValueChange={handleBrandChange}>
						<SelectTrigger className="h-8 w-[180px]">
							<span className="flex flex-1 truncate text-left">{brandLabel}</span>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Todas las marcas</SelectItem>
							{(brandsData ?? []).map((brand) => (
								<SelectItem key={brand.id} value={brand.slug}>
									{brand.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col gap-1.5">
					<label className="text-muted-foreground text-xs font-medium">Categoría</label>
					<Select value={filters.categorySlug ?? "all"} onValueChange={handleCategoryChange}>
						<SelectTrigger className="h-8 w-[200px]">
							<span className="flex flex-1 truncate text-left">{categoryLabel}</span>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Todas las categorías</SelectItem>
							{(categoriesData ?? []).map((cat) => (
								<SelectItem key={cat.id} value={cat.slug}>
									{cat.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col gap-1.5">
					<label className="text-muted-foreground text-xs font-medium">Estado</label>
					<Select value={filters.status} onValueChange={handleStatusChange}>
						<SelectTrigger className="h-8 w-[140px]">
							<span className="flex flex-1 text-left">{statusLabel}</span>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Todos</SelectItem>
							<SelectItem value="active">Activos</SelectItem>
							<SelectItem value="inactive">Inactivos</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{hasActiveFilters && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 text-xs"
						onClick={handleClearFilters}
					>
						Limpiar filtros
					</Button>
				)}
			</div>

			{/* Active filter pills */}
			{filters.brandSlug || filters.categorySlug || filters.status !== "all" ? (
				<div className="flex flex-wrap items-center gap-1.5">
					{filters.brandSlug && (
						<Badge
							variant="secondary"
							className="cursor-pointer gap-1 text-xs"
							onClick={handleRemoveBrandFilter}
						>
							Marca: {brandLabel}
							<HugeiconsIcon icon={Cancel01Icon} className="ml-1 size-3" />
						</Badge>
					)}
					{filters.categorySlug && (
						<Badge
							variant="secondary"
							className="cursor-pointer gap-1 text-xs"
							onClick={handleRemoveCategoryFilter}
						>
							Categoría: {categoryLabel}
							<HugeiconsIcon icon={Cancel01Icon} className="ml-1 size-3" />
						</Badge>
					)}
					{filters.status !== "all" && (
						<Badge
							variant="secondary"
							className="cursor-pointer gap-1 text-xs"
							onClick={handleRemoveStatusFilter}
						>
							Estado: {statusLabel}
							<HugeiconsIcon icon={Cancel01Icon} className="ml-1 size-3" />
						</Badge>
					)}
				</div>
			) : null}

			{/* ── Search + Toolbar ─────────────────── */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="relative w-full min-w-0 sm:max-w-md">
					<HugeiconsIcon
						icon={Search01Icon}
						className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						placeholder="Buscar por nombre, SKU o slug…"
						value={localSearch}
						onChange={(event) => handleSearchChange(event.target.value)}
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
};
