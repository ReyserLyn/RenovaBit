import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card } from "@renovabit/ui/components/ui/card";
import { Input } from "@renovabit/ui/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import {
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	type PaginationState,
	useReactTable,
} from "@tanstack/react-table";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import { notificationKeys } from "../hooks/notification-queries";
import type { AppNotification, NotificationData } from "../model";
import { notificationDataSchema } from "../model";
import { notificationsService } from "../service/notifications.service";
import { getNotificationColumns } from "./notification-columns";

interface NotificationTableProps {
	onRowClick?: (notification: AppNotification) => void;
	selectedId: string | null;
}

const coreRowModel = getCoreRowModel();
const filteredRowModel = getFilteredRowModel();
const paginationRowModel = getPaginationRowModel();

export const NotificationTable = React.memo(function NotificationTable({
	onRowClick,
	selectedId,
}: NotificationTableProps) {
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 });
	const [globalFilter, setGlobalFilter] = useState("");
	const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

	// Traer todas — paginación client-side como brands
	const { data, isPending } = useQuery({
		queryKey: notificationKeys.lists(),
		queryFn: () => notificationsService.list({ limit: 15 }),
		placeholderData: (prev) => prev,
	});

	const rows = useMemo(() => {
		const raw = data?.notifications ?? [];
		return raw.map((n) => ({
			...n,
			_parsed: notificationDataSchema.parse(n.data) as NotificationData,
		}));
	}, [data]);

	// Resetear a página 1 cuando cambia el filtro
	useEffect(() => {
		setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
	}, [globalFilter]);

	// Sincronizar selección visual con selectedId
	useEffect(() => {
		if (!selectedId) {
			if (Object.keys(rowSelection).length > 0) setRowSelection({});
			return;
		}
		if (!rowSelection[selectedId]) {
			setRowSelection({ [selectedId]: true });
		}
	}, [selectedId]);

	const totalCount = data?.total ?? 0;

	const columns = useMemo(() => getNotificationColumns(), []);

	const table = useReactTable({
		data: rows,
		columns,
		state: { pagination, globalFilter, rowSelection },
		onPaginationChange: setPagination,
		onGlobalFilterChange: setGlobalFilter,
		onRowSelectionChange: setRowSelection,
		enableRowSelection: true,
		getCoreRowModel: coreRowModel,
		getFilteredRowModel: filteredRowModel,
		getPaginationRowModel: paginationRowModel,
		globalFilterFn: (row, _columnId, filterValue: string) => {
			if (!filterValue) return true;
			const search = filterValue.toLowerCase();
			const parsed = (row.original as (typeof rows)[number])._parsed;
			return (
				row.original.id.toLowerCase().includes(search) ||
				(parsed.jobId?.toLowerCase().includes(search) ?? false) ||
				(parsed.reportId?.toLowerCase().includes(search) ?? false)
			);
		},
		getRowId: (row) => row.id,
	});

	const filteredCount = table.getFilteredRowModel().rows.length;

	const handleRowClick = useCallback(
		(row: (typeof rows)[number]) => {
			onRowClick?.(row);
		},
		[onRowClick],
	);

	return (
		<div className="flex flex-col gap-4">
			<div className="relative w-full min-w-0 sm:max-w-md">
				<HugeiconsIcon
					icon={Search01Icon}
					className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					placeholder="Filtrar por ID, Job o Reporte…"
					value={globalFilter}
					onChange={(e) => setGlobalFilter(e.target.value)}
					className="w-full min-w-0 bg-card pl-9"
				/>
			</div>

			<Card className="gap-0 overflow-hidden py-0 shadow-sm">
				<DataGrid
					table={table}
					recordCount={filteredCount}
					isLoading={isPending}
					emptyMessage="No hay notificaciones."
					loadingMessage="Cargando notificaciones…"
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

						{!isPending && totalCount > 0 && (
							<div className="border-border border-t bg-muted/30">
								<DataGridPagination
									selectionInfo={`${totalCount} notificaciones${data?.unreadCount ? ` · ${data.unreadCount} sin leer` : ""}`}
								/>
							</div>
						)}
					</div>
				</DataGrid>
			</Card>
		</div>
	);
});
