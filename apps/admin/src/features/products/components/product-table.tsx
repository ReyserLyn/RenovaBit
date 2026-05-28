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
	type ColumnFiltersState,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type RowSelectionState,
	useReactTable,
} from "@tanstack/react-table";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBrands } from "@/features/brands/hooks";
import { useCategories } from "@/features/categories/hooks";
import { useUsers } from "@/features/users/hooks";
import type { UserSummary } from "@/features/users/model";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridColumnVisibility } from "@/shared/components/data-grid/data-grid-column-visibility";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import { useProductsTableStore } from "@/shared/lib/stores/tables/products-table";
import { productKeys, useProducts, useToggleProductField } from "../hooks";
import { useProductFilters } from "../hooks/use-product-filters";
import type { Product } from "../model";
import { ProductBulkDeleteDialog } from "./product-bulk-delete-dialog";
import { getProductColumns } from "./product-column";

// ── Constants ──────────────────────────────────────

interface ProductTableProps {
	onEdit: (product: Product) => void;
	onDelete: (product: Product) => void;
}

const EMPTY_PRODUCTS: Product[] = [];
const SEARCH_DEBOUNCE_MS = 300;

// Stable row models — created ONCE, never recreated (like old-old-renovabit)
const coreRowModel = getCoreRowModel();
const filteredRowModel = getFilteredRowModel();
const sortedRowModel = getSortedRowModel();
const paginationRowModel = getPaginationRowModel();

// ── Component ──────────────────────────────────────

export const ProductTable = function ProductTable({ onEdit, onDelete }: ProductTableProps) {
	const queryClient = useQueryClient();
	const { data: productsData, isPending, isFetching, isError, error } = useProducts();
	const products = productsData ?? EMPTY_PRODUCTS;
	const toggleProductField = useToggleProductField();

	const { data: brandsData } = useBrands();
	const { data: categoriesData } = useCategories();
	const { data: usersData } = useUsers();

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
	const usersById = useMemo(
		() => new Map<string, UserSummary>((usersData ?? []).map((u) => [u.id, u])),
		[usersData],
	);

	// ── URL-persisted filters (nuqs) ──────────────────
	const filters = useProductFilters();

	// ── Debounced search ─────────────────────────────
	// Local state for instant input feel; URL update is deferred 300ms
	const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const [localSearch, setLocalSearch] = useState(filters.search);

	// Sync URL → local when search changes externally (e.g. URL back/forward)
	useEffect(() => {
		setLocalSearch(filters.search);
	}, [filters.search]);

	const handleSearchChange = useCallback(
		(value: string) => {
			setLocalSearch(value);
			clearTimeout(searchTimerRef.current);
			searchTimerRef.current = setTimeout(() => {
				filters.setSearch(value);
			}, SEARCH_DEBOUNCE_MS);
		},
		[filters.setSearch],
	);

	// Cleanup on unmount
	useEffect(() => {
		return () => clearTimeout(searchTimerRef.current);
	}, []);

	// ── Stable handlers ──────────────────────────────

	const handleRefresh = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: productKeys.all });
	}, [queryClient]);

	const handleToggleStatus = useCallback(
		async (product: Product, isActive: boolean) => {
			await toggleProductField.mutateAsync({ id: product.id, data: { isActive } });
		},
		[toggleProductField],
	);

	const handleToggleFeatured = useCallback(
		async (product: Product, isFeatured: boolean) => {
			await toggleProductField.mutateAsync({ id: product.id, data: { isFeatured } });
		},
		[toggleProductField],
	);

	// ── Select filter handlers wrapped in startTransition ──
	// This keeps the UI responsive — select closes immediately,
	// table recalculation is deferred to low-priority.

	const handleBrandChange = useCallback(
		(value: string | null) => {
			startTransition(() => {
				void filters.setBrandSlug(value === "all" ? null : value);
			});
		},
		[filters.setBrandSlug],
	);

	const handleCategoryChange = useCallback(
		(value: string | null) => {
			startTransition(() => {
				void filters.setCategorySlug(value === "all" ? null : value);
			});
		},
		[filters.setCategorySlug],
	);

	const handleStatusChange = useCallback(
		(value: string | null) => {
			const next = (value ?? "all") as "all" | "active" | "inactive";
			startTransition(() => {
				void filters.setStatus(next);
			});
		},
		[filters.setStatus],
	);

	const handleClearFilters = useCallback(() => {
		startTransition(() => {
			void filters.setBrandSlug(null);
			void filters.setCategorySlug(null);
			void filters.setStatus("all");
			void filters.setSearch("");
		});
	}, [filters.setBrandSlug, filters.setCategorySlug, filters.setStatus, filters.setSearch]);

	const handleRemoveBrandFilter = useCallback(
		() => startTransition(() => void filters.setBrandSlug(null)),
		[filters.setBrandSlug],
	);
	const handleRemoveCategoryFilter = useCallback(
		() => startTransition(() => void filters.setCategorySlug(null)),
		[filters.setCategorySlug],
	);
	const handleRemoveStatusFilter = useCallback(
		() => startTransition(() => void filters.setStatus("all")),
		[filters.setStatus],
	);

	// ── Table state ──────────────────────────────────

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

	// ── Sync nuqs filters → TanStack columnFilters ─────
	useEffect(() => {
		const next: ColumnFiltersState = [];

		if (filters.brandSlug) {
			const brand = brandsBySlug.get(filters.brandSlug);
			if (brand) next.push({ id: "brand", value: brand.id });
		}
		if (filters.categorySlug) {
			const category = categoriesBySlug.get(filters.categorySlug);
			if (category) next.push({ id: "category", value: category.id });
		}
		if (filters.status === "active") {
			next.push({ id: "isActive", value: true });
		} else if (filters.status === "inactive") {
			next.push({ id: "isActive", value: false });
		}

		setColumnFilters(next);
	}, [filters.brandSlug, filters.categorySlug, filters.status, brandsBySlug, categoriesBySlug]);

	// ── Columns ──────────────────────────────────────

	const columns = useMemo(
		() =>
			getProductColumns({
				onEdit,
				onDelete,
				onToggleStatus: handleToggleStatus,
				onToggleFeatured: handleToggleFeatured,
				brandsById,
				categoriesById,
				usersById,
			}),
		[
			onEdit,
			onDelete,
			handleToggleStatus,
			handleToggleFeatured,
			brandsById,
			categoriesById,
			usersById,
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
	}, [columnFilters]);

	// ── Derived values (rerender-derived-state-no-effect) ──

	const filteredCount = table.getFilteredRowModel().rows.length;
	const selectedRows = table.getFilteredSelectedRowModel().rows;
	const selectedProducts = selectedRows.map((row) => row.original);
	const selectedCount = selectedProducts.length;
	const selectionInfo = `${selectedCount} de ${filteredCount} filas seleccionadas`;

	const selectedBrand = filters.brandSlug ? brandsBySlug.get(filters.brandSlug) : null;
	const selectedCategory = filters.categorySlug ? categoriesBySlug.get(filters.categorySlug) : null;

	const brandLabel = selectedBrand?.name ?? "Todas las marcas";
	const categoryLabel = selectedCategory?.name ?? "Todas las categorías";
	const statusLabel =
		filters.status === "active" ? "Activos" : filters.status === "inactive" ? "Inactivos" : "Todos";

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

				{(filters.brandSlug ||
					filters.categorySlug ||
					filters.status !== "all" ||
					filters.search) && (
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
