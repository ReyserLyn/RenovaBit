import { ReloadIcon, Search01Icon, Settings02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { Card } from "@renovabit/ui/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@renovabit/ui/components/ui/dropdown-menu";
import { Input } from "@renovabit/ui/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@renovabit/ui/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import {
	getCoreRowModel,
	type PaginationState,
	type RowSelectionState,
	useReactTable,
} from "@tanstack/react-table";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridColumnVisibility } from "@/shared/components/data-grid/data-grid-column-visibility";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import { ConfirmDialog } from "@/shared/components/dialog/confirm-dialog";
import { useDebouncedValue } from "@/shared/lib/hooks/use-debounced-value";
import { useOrdersTableStore } from "@/shared/lib/stores/tables/orders-table";
import { orderKeys, useBatchOrderStatus, usePaginatedOrders, useUpdateOrderStatus } from "../hooks";
import {
	ORDER_STATUS_CONFIG,
	type OrderListItem,
	type OrderStatus,
	STATUS_CHANGE_LABEL,
} from "../model";
import type { BatchActionStatus } from "../service/orders.service";
import { getOrderColumns } from "./order-column";

// ── Constants ────────────────────────────────────────────

const coreRowModel = getCoreRowModel();

const statusFilterOptions = [
	{ label: "Todos los estados", value: "all" },
	...Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => ({
		label: config.label,
		value: key,
	})),
];

// ── Props ────────────────────────────────────────────────

interface OrderTableProps {
	onViewDetail: (orderId: string) => void;
}

// ── Component ────────────────────────────────────────────

export const OrderTable = React.memo(function OrderTable({ onViewDetail }: OrderTableProps) {
	const queryClient = useQueryClient();
	const [statusFilter, setStatusFilter] = useState<OrderStatus | undefined>();
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);

	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10,
	});

	// ── Server-side query ──

	const { data, isPending, isFetching, isError, error } = usePaginatedOrders({
		page: pagination.pageIndex,
		pageSize: pagination.pageSize,
		status: statusFilter,
		search: debouncedSearch,
	});

	const orders = data?.orders ?? [];
	const totalCount = data?.total ?? 0;

	const updateOrderStatus = useUpdateOrderStatus();
	const batchUpdateStatus = useBatchOrderStatus();

	// ── Status change confirmation state ──
	const [confirmState, setConfirmState] = useState<{
		order: OrderListItem;
		newStatus: OrderStatus;
	} | null>(null);
	const isStatusChanging = updateOrderStatus.isPending;
	const isBatchProcessing = batchUpdateStatus.isPending;

	// ── Bulk state ──
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const [bulkConfirm, setBulkConfirm] = useState<{
		action: BatchActionStatus;
	} | null>(null);

	// ── Reset page on filter change ──
	useEffect(() => {
		setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
	}, [debouncedSearch, statusFilter]);

	useEffect(() => {
		setPagination((prev) => ({ ...prev, pageIndex: 0 }));
	}, [pagination.pageSize]);

	// ── Handlers ──

	const handleRefresh = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
	}, [queryClient]);

	const handleViewDetail = useCallback(
		(order: OrderListItem) => {
			onViewDetail(order.id);
		},
		[onViewDetail],
	);

	const handleStatusChangeRequest = useCallback((order: OrderListItem, newStatus: OrderStatus) => {
		setConfirmState({ order, newStatus });
	}, []);

	const handleStatusChangeConfirm = useCallback(async () => {
		if (!confirmState) return;
		const { order, newStatus } = confirmState;
		try {
			await updateOrderStatus.mutateAsync({
				id: order.id,
				data: { status: newStatus },
			});
		} catch {
			// mutation onError already shows toast
		} finally {
			setConfirmState(null);
		}
	}, [confirmState, updateOrderStatus]);

	const handleBulkConfirm = useCallback(async () => {
		if (!bulkConfirm) return;
		const ids = Object.keys(rowSelection);
		if (ids.length === 0) return;
		try {
			await batchUpdateStatus.mutateAsync({ ids, action: bulkConfirm.action });
		} catch {
			// handled by mutation
		} finally {
			setBulkConfirm(null);
			setRowSelection({});
		}
	}, [bulkConfirm, rowSelection, batchUpdateStatus]);

	// ── Columns ──

	const columns = useMemo(
		() =>
			getOrderColumns({
				onViewDetail: handleViewDetail,
				onStatusChange: handleStatusChangeRequest,
			}),
		[handleViewDetail, handleStatusChangeRequest],
	);

	// ── Table state ──

	const sorting = useOrdersTableStore((s) => s.sorting);
	const setSorting = useOrdersTableStore((s) => s.setSorting);
	const columnVisibility = useOrdersTableStore((s) => s.columnVisibility);
	const setColumnVisibility = useOrdersTableStore((s) => s.setColumnVisibility);

	const table = useReactTable({
		data: orders,
		columns,
		state: {
			pagination,
			sorting,
			columnVisibility,
			rowSelection,
		},
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		getCoreRowModel: coreRowModel,
		manualPagination: true,
		rowCount: totalCount,
		enableRowSelection: true,
		getRowId: (row) => row.id,
	});

	// ── Render ──

	return (
		<>
			<div className="flex flex-col gap-4">
				{isError ? (
					<div className="bg-destructive/5 border-destructive/40 flex flex-col items-start gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-sm">
							No se pudieron cargar los pedidos.
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
					<div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
						<div className="relative w-full min-w-0 sm:max-w-xs">
							<HugeiconsIcon
								icon={Search01Icon}
								className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								placeholder="Buscar por pedido o cliente…"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								className="w-full min-w-0 bg-card pl-9"
							/>
						</div>
						<Select
							items={statusFilterOptions}
							value={statusFilter ?? "all"}
							onValueChange={(value) => {
								const validStatuses: readonly OrderStatus[] = [
									"pending",
									"confirmed",
									"cancelled",
									"refunded",
								];
								setStatusFilter(
									value === "all" ? undefined : validStatuses.find((s) => s === value),
								);
							}}
						>
							<SelectTrigger className="h-9 w-[180px] bg-card">
								<SelectValue placeholder="Todos los estados" />
							</SelectTrigger>
							<SelectContent>
								{statusFilterOptions.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						{Object.keys(rowSelection).length > 0 && (
							<DropdownMenu>
								<DropdownMenuTrigger
									render={
										<Button
											variant="outline"
											size="sm"
											className="h-8 bg-card border-destructive/40 text-destructive"
										>
											{Object.keys(rowSelection).length} seleccionados
										</Button>
									}
								/>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onClick={() => setBulkConfirm({ action: "confirmed" })}>
										Confirmar pedidos
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() => setBulkConfirm({ action: "cancelled" })}
										className="text-destructive"
									>
										Cancelar pedidos
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setBulkConfirm({ action: "refunded" })}>
										Reembolsar pedidos
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
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
						emptyMessage="No se encontraron pedidos."
						loadingMessage="Cargando pedidos…"
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
									<DataGridPagination
										selectionInfo={`${Object.keys(rowSelection).length} de ${totalCount} filas seleccionadas`}
									/>
								</div>
							)}
						</div>
					</DataGrid>
				</Card>
			</div>

			{confirmState
				? (() => {
						const statusLabel =
							Object.entries(ORDER_STATUS_CONFIG).find(
								([key]) => key === confirmState.newStatus,
							)?.[1].label ?? confirmState.newStatus;

						return (
							<ConfirmDialog
								isOpen
								onClose={() => {
									if (!isStatusChanging) setConfirmState(null);
								}}
								onConfirm={handleStatusChangeConfirm}
								title={STATUS_CHANGE_LABEL[confirmState.newStatus] ?? "Cambiar estado"}
								description={`¿Estás seguro de que deseas cambiar el pedido ${confirmState.order.orderNumber} a "${statusLabel}"?`}
								confirmText={STATUS_CHANGE_LABEL[confirmState.newStatus] ?? "Confirmar"}
								isLoading={isStatusChanging}
								variant={confirmState.newStatus === "cancelled" ? "destructive" : "default"}
							/>
						);
					})()
				: null}

			{bulkConfirm ? (
				<ConfirmDialog
					isOpen
					onClose={() => {
						if (!isBatchProcessing) setBulkConfirm(null);
					}}
					onConfirm={handleBulkConfirm}
					title={`${STATUS_CHANGE_LABEL[bulkConfirm.action] ?? "Procesar"} ${Object.keys(rowSelection).length} pedidos`}
					description={`¿Estás seguro de que deseas ${(STATUS_CHANGE_LABEL[bulkConfirm.action] ?? "procesar").toLowerCase()} los ${Object.keys(rowSelection).length} pedidos seleccionados?`}
					confirmText={STATUS_CHANGE_LABEL[bulkConfirm.action] ?? "Confirmar"}
					isLoading={isBatchProcessing}
					variant={bulkConfirm.action === "cancelled" ? "destructive" : "default"}
				/>
			) : null}
		</>
	);
});
