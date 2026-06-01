import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { Card } from "@renovabit/ui/components/ui/card";
import { Input } from "@renovabit/ui/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { getCoreRowModel, type PaginationState, useReactTable } from "@tanstack/react-table";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import { useDebouncedValue } from "@/shared/lib/hooks/use-debounced-value";
import { notificationsPaginatedQueryOptions } from "../hooks/notification-queries";
import type { AppNotification, NotificationData } from "../model";
import { notificationDataSchema } from "../model";
import { getNotificationColumns } from "./notification-columns";

interface NotificationTableProps {
	onRowClick?: (notification: AppNotification) => void;
	selectedId: string | null;
}

const coreRowModel = getCoreRowModel();

type EnrichedRow = AppNotification & { _parsed: NotificationData };

export const NotificationTable = React.memo(function NotificationTable({
	onRowClick,
	selectedId,
}: NotificationTableProps) {
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 });
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);
	const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

	// ── Server-side pagination ──────────────────────────

	const { data, isPending, isError, error, refetch } = useQuery(
		notificationsPaginatedQueryOptions({
			page: pagination.pageIndex + 1,
			pageSize: pagination.pageSize,
			search: debouncedSearch || undefined,
		}),
	);

	const notifications = data?.notifications ?? [];
	const totalCount = data?.total ?? 0;
	const unreadCount = data?.unreadCount ?? 0;

	const rows = useMemo(() => {
		return notifications.map((n) => {
			const result = notificationDataSchema.safeParse(n.data);
			return {
				...n,
				_parsed: result.success ? (result.data as NotificationData) : ({} as NotificationData),
			};
		});
	}, [notifications]);

	// Resetear a página 1 cuando cambia la búsqueda
	useEffect(() => {
		setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
	}, [debouncedSearch]);

	// Resetear a página 1 cuando cambia el pageSize
	useEffect(() => {
		setPagination((prev) => ({ ...prev, pageIndex: 0 }));
	}, [pagination.pageSize]);

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

	const columns = useMemo(() => getNotificationColumns(), []);

	const table = useReactTable({
		data: rows,
		columns,
		state: { pagination, rowSelection },
		onPaginationChange: setPagination,
		onRowSelectionChange: setRowSelection,
		enableRowSelection: true,
		manualPagination: true,
		rowCount: totalCount,
		getCoreRowModel: coreRowModel,
		getRowId: (row) => row.id,
	});

	const handleRowClick = useCallback(
		(row: EnrichedRow) => {
			onRowClick?.(row);
		},
		[onRowClick],
	);

	const handleRefresh = useCallback(() => {
		refetch();
	}, [refetch]);

	return (
		<div className="flex flex-col gap-4">
			{isError ? (
				<div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm">
						No se pudieron cargar las notificaciones.
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

			{/* ── Search ─────────────────── */}
			<div className="relative w-full min-w-0 sm:max-w-md">
				<HugeiconsIcon
					icon={Search01Icon}
					className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					placeholder="Buscar por ID, Job o Reporte…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="w-full min-w-0 bg-card pl-9"
				/>
			</div>

			<Card className="gap-0 overflow-hidden py-0 shadow-sm">
				<DataGrid
					table={table}
					recordCount={totalCount}
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

						{totalCount > 0 && (
							<div className="border-border border-t bg-muted/30">
								<DataGridPagination
									selectionInfo={`${totalCount} notificaciones${unreadCount > 0 ? ` · ${unreadCount} sin leer` : ""}`}
								/>
							</div>
						)}
					</div>
				</DataGrid>
			</Card>
		</div>
	);
});
