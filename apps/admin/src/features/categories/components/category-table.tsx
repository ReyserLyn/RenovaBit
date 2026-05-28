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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useUsers } from "@/features/users/hooks";
import type { UserSummary } from "@/features/users/model";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridColumnVisibility } from "@/shared/components/data-grid/data-grid-column-visibility";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import { useCategoriesTableStore } from "@/shared/lib/stores/tables/categories-table";
import { categoryKeys, useCategories, useToggleCategoryField } from "../hooks";
import type { Category } from "../model";
import { CategoryBulkDeleteDialog } from "./category-bulk-delete-dialog";
import { getCategoryColumns } from "./category-column";

interface CategoryTableProps {
	onEdit: (category: Category) => void;
	onDelete: (category: Category) => void;
}

const EMPTY_CATEGORIES: Category[] = [];

// Stable row models — created ONCE, never recreated
const coreRowModel = getCoreRowModel();
const filteredRowModel = getFilteredRowModel();
const sortedRowModel = getSortedRowModel();
const paginationRowModel = getPaginationRowModel();

export const CategoryTable = React.memo(function CategoryTable({
	onEdit,
	onDelete,
}: CategoryTableProps) {
	const queryClient = useQueryClient();
	const { data: categoriesData, isPending, isFetching, isError, error } = useCategories();
	const categories = categoriesData ?? EMPTY_CATEGORIES;
	const toggleCategoryField = useToggleCategoryField();
	const { data: usersData } = useUsers();

	// Stabilize lookup maps (js-index-maps)
	const usersById = useMemo(
		() => new Map<string, UserSummary>((usersData ?? []).map((u) => [u.id, u])),
		[usersData],
	);
	const categoriesById = useMemo(
		() => new Map((categories ?? []).map((c) => [c.id, c])),
		[categories],
	);

	// Stable refresh handler
	const handleRefresh = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
	}, [queryClient]);

	// Stable toggle handlers
	const handleToggleStatus = useCallback(
		async (category: Category, isActive: boolean) => {
			await toggleCategoryField.mutateAsync({ id: category.id, data: { isActive } });
		},
		[toggleCategoryField],
	);

	const handleToggleFeatured = useCallback(
		async (category: Category, isFeatured: boolean) => {
			await toggleCategoryField.mutateAsync({ id: category.id, data: { isFeatured } });
		},
		[toggleCategoryField],
	);

	const handleToggleNavVisibility = useCallback(
		async (category: Category, isVisibleInNav: boolean) => {
			await toggleCategoryField.mutateAsync({ id: category.id, data: { isVisibleInNav } });
		},
		[toggleCategoryField],
	);

	// Stabilize columns array to prevent table re-initialization
	const columns = useMemo(
		() =>
			getCategoryColumns({
				onEdit,
				onDelete,
				onToggleStatus: handleToggleStatus,
				onToggleFeatured: handleToggleFeatured,
				onToggleNavVisibility: handleToggleNavVisibility,
				categoriesById,
				usersById,
			}),
		[
			onEdit,
			onDelete,
			handleToggleStatus,
			handleToggleFeatured,
			handleToggleNavVisibility,
			categoriesById,
			usersById,
		],
	);

	const [pagination, setPagination] = useState<PaginationState>(() => ({
		pageIndex: 0,
		pageSize: 10,
	}));
	const sorting = useCategoriesTableStore((s) => s.sorting);
	const setSorting = useCategoriesTableStore((s) => s.setSorting);
	const columnVisibility = useCategoriesTableStore((s) => s.columnVisibility);
	const setColumnVisibility = useCategoriesTableStore((s) => s.setColumnVisibility);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

	const table = useReactTable({
		data: categories,
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
		getCoreRowModel: coreRowModel,
		getFilteredRowModel: filteredRowModel,
		getSortedRowModel: sortedRowModel,
		getPaginationRowModel: paginationRowModel,
		enableRowSelection: true,
		getRowId: (row) => row.id,
	});

	useEffect(() => {
		const validIds = new Set(categories.map((c) => c.id));
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
	}, [categories, table]);

	useEffect(() => {
		setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
	}, [columnFilters]);

	const filteredCount = table.getFilteredRowModel().rows.length;
	const selectedRows = table.getFilteredSelectedRowModel().rows;
	const selectedCategories = selectedRows.map((row) => row.original);
	const selectedCount = selectedCategories.length;
	const selectionInfo = `${selectedCount} de ${filteredCount} filas seleccionadas`;

	return (
		<div className="flex flex-col gap-4">
			{isError ? (
				<div className="bg-destructive/5 border-destructive/40 flex flex-col items-start gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm">
						No se pudieron cargar las categorías.
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
						placeholder="Filtrar categorías por nombre…"
						value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
						onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
						className="w-full min-w-0 bg-card pl-9"
					/>
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2 sm:ms-auto">
					<CategoryBulkDeleteDialog selectedCategories={selectedCategories} />
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
					emptyMessage="No se encontraron categorías."
					loadingMessage="Cargando categorías…"
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
