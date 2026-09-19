import { Button } from "@renovabit/ui/components/ui/button";
import { Card } from "@renovabit/ui/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@renovabit/ui/components/ui/select";
import { getCoreRowModel, type PaginationState, useReactTable } from "@tanstack/react-table";
import React, { useCallback, useMemo, useState } from "react";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import { useSyncReports } from "../hooks/sync-reports-queries";
import {
	isSyncStatusFilter,
	SYNC_STATUS_OPTIONS,
	type SyncReportSummary,
	type SyncStatusFilter,
} from "../model";
import { getSyncReportColumns } from "./sync-report-columns";

interface SyncReportsTableProps {
	onRowClick?: (report: SyncReportSummary) => void;
}

const coreRowModel = getCoreRowModel();

export const SyncReportsTable = React.memo(function SyncReportsTable({
	onRowClick,
}: SyncReportsTableProps) {
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 15,
	});
	const [status, setStatus] = useState<SyncStatusFilter>("all");

	const { data, isPending, isFetching, isError, error, refetch } = useSyncReports({
		page: pagination.pageIndex + 1,
		pageSize: pagination.pageSize,
		status: status === "all" ? undefined : status,
	});

	const reports = data?.reports ?? [];
	const totalCount = data?.total ?? 0;

	const columns = useMemo(() => getSyncReportColumns(), []);

	const table = useReactTable({
		data: reports,
		columns,
		state: { pagination },
		onPaginationChange: setPagination,
		manualPagination: true,
		rowCount: totalCount,
		getCoreRowModel: coreRowModel,
		getRowId: (row) => row.id,
	});

	const handleRowClick = useCallback(
		(report: SyncReportSummary) => {
			onRowClick?.(report);
		},
		[onRowClick],
	);

	const handleRefresh = useCallback(() => {
		void refetch();
	}, [refetch]);

	return (
		<div className="flex flex-col gap-4">
			{isError ? (
				<div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm">
						No se pudieron cargar los reportes de sincronización.
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
				<div className="flex flex-col gap-1.5">
					<label htmlFor="sync-status-filter" className="text-muted-foreground text-xs font-medium">
						Estado
					</label>
					<Select
						items={SYNC_STATUS_OPTIONS}
						value={status}
						onValueChange={(value) => {
							setStatus(isSyncStatusFilter(value) ? value : "all");
							// Volver a la primera página al cambiar el filtro.
							setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
						}}
					>
						<SelectTrigger id="sync-status-filter" className="h-8 w-[150px] bg-card">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{SYNC_STATUS_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			<Card className="gap-0 overflow-hidden py-0 shadow-sm">
				<DataGrid
					table={table}
					recordCount={totalCount}
					isLoading={isPending}
					emptyMessage="No hay reportes de sincronización."
					loadingMessage="Cargando reportes…"
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
								<DataGridPagination selectionInfo={`${totalCount} reportes`} />
							</div>
						)}
					</div>
				</DataGrid>
			</Card>
		</div>
	);
});
