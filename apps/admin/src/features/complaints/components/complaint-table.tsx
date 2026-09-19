import { ReloadIcon, Search01Icon, Settings02Icon } from "@hugeicons/core-free-icons";
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
import { useQueryClient } from "@tanstack/react-query";
import { getCoreRowModel, type PaginationState, useReactTable } from "@tanstack/react-table";
import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridColumnVisibility } from "@/shared/components/data-grid/data-grid-column-visibility";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import { useComplaintsTableStore } from "@/shared/lib/stores/tables/complaints-table";
import { complaintKeys, usePaginatedComplaints } from "../hooks";
import { useComplaintFilters } from "../hooks/use-complaint-filters";
import { COMPLAINT_STATUS_FILTER_OPTIONS, type ComplaintListItem } from "../model";
import { getComplaintColumns } from "./complaints-column";

const EMPTY_COMPLAINTS: ComplaintListItem[] = [];

const coreRowModel = getCoreRowModel();

interface ComplaintTableProps {
	onViewDetail: (complaintId: string) => void;
}

export const ComplaintTable = React.memo(function ComplaintTable({
	onViewDetail,
}: ComplaintTableProps) {
	const queryClient = useQueryClient();

	const filters = useComplaintFilters();

	const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const [localSearch, setLocalSearch] = useState(filters.search);

	useEffect(() => {
		setLocalSearch(filters.search);
	}, [filters.search]);

	const handleSearchChange = useCallback(
		(value: string) => {
			setLocalSearch(value);
			clearTimeout(searchTimerRef.current);
			searchTimerRef.current = setTimeout(() => {
				startTransition(() => {
					void filters.setSearch(value);
				});
			}, 300);
		},
		[filters.setSearch],
	);

	useEffect(() => {
		return () => clearTimeout(searchTimerRef.current);
	}, []);

	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: filters.page,
		pageSize: filters.pageSize,
	});

	useEffect(() => {
		startTransition(() => {
			void filters.setPage(pagination.pageIndex);
		});
	}, [pagination.pageIndex, filters.setPage]);

	useEffect(() => {
		startTransition(() => {
			void filters.setPageSize(pagination.pageSize);
		});
	}, [pagination.pageSize, filters.setPageSize]);

	const { data, isPending, isFetching, isError, error } = usePaginatedComplaints({
		page: pagination.pageIndex,
		pageSize: pagination.pageSize,
		status: filters.apiStatus,
		search: filters.search || undefined,
	});

	const complaints = data?.complaints ?? EMPTY_COMPLAINTS;
	const totalCount = data?.total ?? 0;

	// With server-side pagination, changing a filter while on page N can leave
	// the grid empty: always go back to the first page.
	const filtersKey = [filters.status, filters.search].join("\u0000");
	const prevFiltersKeyRef = useRef(filtersKey);
	useEffect(() => {
		if (prevFiltersKeyRef.current === filtersKey) return;
		prevFiltersKeyRef.current = filtersKey;
		setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
	}, [filtersKey]);

	const handlePaginationChange = useCallback(
		(updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
			setPagination((prev) => {
				const next = typeof updater === "function" ? updater(prev) : updater;
				return next.pageSize !== prev.pageSize ? { ...next, pageIndex: 0 } : next;
			});
		},
		[],
	);

	const handleRefresh = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: complaintKeys.lists() });
	}, [queryClient]);

	const handleViewDetail = useCallback(
		(complaint: ComplaintListItem) => {
			onViewDetail(complaint.id);
		},
		[onViewDetail],
	);

	const handleClearFilters = useCallback(() => {
		startTransition(() => {
			void filters.setStatus("all");
			void filters.setSearch("");
		});
	}, [filters.setStatus, filters.setSearch]);

	const hasActiveFilters = filters.status !== "all" || !!filters.search;

	const columns = useMemo(
		() => getComplaintColumns({ onViewDetail: handleViewDetail }),
		[handleViewDetail],
	);

	const columnVisibility = useComplaintsTableStore((s) => s.columnVisibility);
	const setColumnVisibility = useComplaintsTableStore((s) => s.setColumnVisibility);

	const table = useReactTable({
		data: complaints,
		columns,
		state: {
			pagination,
			columnVisibility,
		},
		onPaginationChange: handlePaginationChange,
		onColumnVisibilityChange: setColumnVisibility,
		getCoreRowModel: coreRowModel,
		manualPagination: true,
		rowCount: totalCount,
		getRowId: (row) => row.id,
	});

	return (
		<div className="flex flex-col gap-4">
			{isError ? (
				<div className="bg-destructive/5 border-destructive/40 flex flex-col items-start gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm">
						No se pudieron cargar los reclamos.
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

			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1.5">
					<label className="text-muted-foreground text-xs font-medium">Estado</label>
					<Select
						items={COMPLAINT_STATUS_FILTER_OPTIONS}
						value={filters.status}
						onValueChange={(value) => {
							startTransition(() => {
								void filters.setStatus(value);
							});
						}}
					>
						<SelectTrigger className="h-8 w-[170px] bg-card">
							<SelectValue placeholder="Estado" />
						</SelectTrigger>
						<SelectContent>
							{COMPLAINT_STATUS_FILTER_OPTIONS.map((item) => (
								<SelectItem key={item.value} value={item.value}>
									{item.label}
								</SelectItem>
							))}
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

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="relative w-full min-w-0 sm:max-w-md">
					<HugeiconsIcon
						icon={Search01Icon}
						className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						placeholder="Buscar por código, documento o nombre…"
						value={localSearch}
						onChange={(event) => handleSearchChange(event.target.value)}
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
					recordCount={totalCount}
					isLoading={isPending}
					emptyMessage="No se encontraron reclamos."
					loadingMessage="Cargando reclamos…"
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

						{totalCount > 0 && (
							<div className="border-border border-t bg-muted/30">
								<DataGridPagination />
							</div>
						)}
					</div>
				</DataGrid>
			</Card>
		</div>
	);
});
