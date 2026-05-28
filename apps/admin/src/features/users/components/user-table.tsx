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
import { useCallback, useEffect, useState } from "react";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridColumnVisibility } from "@/shared/components/data-grid/data-grid-column-visibility";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import { useUsersTableStore } from "@/shared/lib/stores/tables/users-table";
import { userKeys, useUsers } from "../hooks";
import { getUserColumns } from "./user-column";

const EMPTY_USERS: NonNullable<ReturnType<typeof useUsers>["data"]> = [];
const COLUMNS = getUserColumns();

// Stable row models — created ONCE, never recreated
const coreRowModel = getCoreRowModel();
const filteredRowModel = getFilteredRowModel();
const sortedRowModel = getSortedRowModel();
const paginationRowModel = getPaginationRowModel();

export const UserTable = function UserTable() {
	const queryClient = useQueryClient();
	const { data: usersData, isPending, isFetching, isError, error } = useUsers();
	const users = usersData ?? EMPTY_USERS;

	const handleRefresh = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: userKeys.all });
	}, [queryClient]);

	const [pagination, setPagination] = useState<PaginationState>(() => ({
		pageIndex: 0,
		pageSize: 10,
	}));
	const sorting = useUsersTableStore((s) => s.sorting);
	const setSorting = useUsersTableStore((s) => s.setSorting);
	const columnVisibility = useUsersTableStore((s) => s.columnVisibility);
	const setColumnVisibility = useUsersTableStore((s) => s.setColumnVisibility);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

	const table = useReactTable({
		data: users,
		columns: COLUMNS,
		state: { pagination, sorting, columnFilters, columnVisibility },
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

	useEffect(() => {
		setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
	}, [columnFilters]);

	const filteredCount = table.getFilteredRowModel().rows.length;

	return (
		<div className="flex flex-col gap-4">
			{isError ? (
				<div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm">
						No se pudieron cargar los usuarios.
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
						placeholder="Filtrar usuarios por nombre…"
						value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
						onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
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
					emptyMessage="No se encontraron usuarios."
					loadingMessage="Cargando usuarios…"
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
								<DataGridPagination />
							</div>
						) : null}
					</div>
				</DataGrid>
			</Card>
		</div>
	);
};
