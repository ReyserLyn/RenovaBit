import {
	Calendar01Icon,
	ReloadIcon,
	Search01Icon,
	Settings02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { Calendar } from "@renovabit/ui/components/ui/calendar";
import { Card } from "@renovabit/ui/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@renovabit/ui/components/ui/dropdown-menu";
import { Input } from "@renovabit/ui/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@renovabit/ui/components/ui/popover";
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
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridColumnVisibility } from "@/shared/components/data-grid/data-grid-column-visibility";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import { ConfirmDialog } from "@/shared/components/dialog/confirm-dialog";
import { useOrdersTableStore } from "@/shared/lib/stores/tables/orders-table";
import { orderKeys, useBatchOrderStatus, usePaginatedOrders, useUpdateOrderStatus } from "../hooks";
import { sortFieldValues, useOrderFilters } from "../hooks/use-order-filters";
import {
	ORDER_STATUS_CONFIG,
	type OrderListItem,
	type OrderStatus,
	STATUS_CHANGE_LABEL,
} from "../model";
import type { BatchActionStatus } from "../service/orders.service";
import { getOrderColumns } from "./order-column";

function isSortField(v: string): v is (typeof sortFieldValues)[number] {
	return (sortFieldValues as readonly string[]).includes(v);
}

const coreRowModel = getCoreRowModel();

const statusFilterOptions = [
	{ label: "Todos los estados", value: "all" },
	{ label: "Pendiente", value: "pendiente" },
	{ label: "Confirmado", value: "confirmado" },
	{ label: "Cancelado", value: "cancelado" },
	{ label: "Reembolsado", value: "reembolsado" },
];

const sourceFilterOptions = [
	{ label: "Todos los orígenes", value: "all" },
	{ label: "Web", value: "web" },
	{ label: "WhatsApp", value: "whatsapp" },
];

const paymentMethodFilterOptions = [
	{ label: "Todos los métodos", value: "all" },
	{ label: "Efectivo", value: "efectivo" },
	{ label: "Transferencia", value: "transferencia" },
	{ label: "Yape", value: "yape" },
	{ label: "Plin", value: "plin" },
];

interface OrderTableProps {
	onViewDetail: (orderId: string) => void;
}

export const OrderTable = React.memo(function OrderTable({ onViewDetail }: OrderTableProps) {
	const queryClient = useQueryClient();

	const filters = useOrderFilters();

	const fromDate = useMemo(
		() => (filters.from ? new Date(`${filters.from}T00:00:00`) : undefined),
		[filters.from],
	);
	const toDate = useMemo(
		() => (filters.to ? new Date(`${filters.to}T00:00:00`) : undefined),
		[filters.to],
	);

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

	const dateRangeValid = !fromDate || !toDate || fromDate <= toDate;
	const fmtDateFrom = (d: Date | undefined) => (d ? format(d, "yyyy-MM-dd") : undefined);
	const fmtDateTo = (d: Date | undefined) => (d ? format(d, "yyyy-MM-dd") : undefined);

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

	const sorting = useOrdersTableStore((s) => s.sorting);

	const sortBy: (typeof sortFieldValues)[number] | undefined =
		filters.sortBy ??
		(sorting[0] && isSortField(sorting[0].id) ? sorting[0].id : undefined) ??
		"createdAt";

	const { data, isPending, isFetching, isError, error } = usePaginatedOrders({
		page: pagination.pageIndex,
		pageSize: pagination.pageSize,
		status: filters.apiStatus,
		source: filters.apiSource,
		paymentMethod: filters.apiPayment,
		from: dateRangeValid ? fmtDateFrom(fromDate) : undefined,
		to: dateRangeValid ? fmtDateTo(toDate) : undefined,
		search: filters.search || undefined,
		sortBy,
		sortOrder: filters.sortOrder ?? (sorting[0]?.desc ? "desc" : "asc"),
	});

	const orders = data?.orders ?? [];
	const totalCount = data?.total ?? 0;

	const updateOrderStatus = useUpdateOrderStatus();
	const batchUpdateStatus = useBatchOrderStatus();

	const [confirmState, setConfirmState] = useState<{
		order: OrderListItem;
		newStatus: OrderStatus;
	} | null>(null);
	const isStatusChanging = updateOrderStatus.isPending;
	const isBatchProcessing = batchUpdateStatus.isPending;

	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const [bulkConfirm, setBulkConfirm] = useState<{
		action: BatchActionStatus;
	} | null>(null);

	useEffect(() => {
		setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
	}, [
		filters.search,
		filters.status,
		filters.source,
		filters.paymentMethod,
		filters.from,
		filters.to,
	]);

	useEffect(() => {
		setPagination((prev) => ({ ...prev, pageIndex: 0 }));
	}, [pagination.pageSize]);

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
			//
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
			//
		} finally {
			setBulkConfirm(null);
			setRowSelection({});
		}
	}, [bulkConfirm, rowSelection, batchUpdateStatus]);

	const hasActiveFilters =
		filters.status !== "all" ||
		filters.source !== "all" ||
		filters.paymentMethod !== "all" ||
		!!filters.search ||
		!!filters.from ||
		!!filters.to;

	const handleClearFilters = useCallback(() => {
		startTransition(() => {
			void filters.setStatus("all");
			void filters.setSource("all");
			void filters.setPaymentMethod("all");
			void filters.setSearch("");
			void filters.setFrom(null);
			void filters.setTo(null);
		});
	}, [
		filters.setStatus,
		filters.setSource,
		filters.setPaymentMethod,
		filters.setSearch,
		filters.setFrom,
		filters.setTo,
	]);

	const handleSortingChange = useCallback(
		(updater: SortingState | ((prev: SortingState) => SortingState)) => {
			const store = useOrdersTableStore.getState();
			const next = typeof updater === "function" ? updater(store.sorting) : updater;
			store.setSorting(next);

			const col = next[0];
			if (col && isSortField(col.id)) {
				void filters.setSortBy(col.id);
				void filters.setSortOrder(col.desc ? "desc" : "asc");
			}
		},
		[filters.setSortBy, filters.setSortOrder],
	);

	const columns = useMemo(
		() =>
			getOrderColumns({
				onViewDetail: handleViewDetail,
				onStatusChange: handleStatusChangeRequest,
			}),
		[handleViewDetail, handleStatusChangeRequest],
	);

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
		onSortingChange: handleSortingChange,
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		getCoreRowModel: coreRowModel,
		manualPagination: true,
		manualSorting: true,
		rowCount: totalCount,
		enableRowSelection: true,
		getRowId: (row) => row.id,
	});

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

				<div className="flex flex-wrap items-end gap-3">
					<div className="flex flex-col gap-1.5">
						<label className="text-muted-foreground text-xs font-medium">Estado</label>
						<Select
							items={statusFilterOptions}
							value={filters.status}
							onValueChange={(value) => {
								startTransition(() => {
									void filters.setStatus(value);
								});
							}}
						>
							<SelectTrigger className="h-8 w-[150px] bg-card [&_[data-slot=select-value]]:truncate">
								<SelectValue placeholder="Estado" />
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
					<div className="flex flex-col gap-1.5">
						<label className="text-muted-foreground text-xs font-medium ">Origen</label>
						<Select
							items={sourceFilterOptions}
							value={filters.source}
							onValueChange={(value) =>
								startTransition(() => {
									void filters.setSource(value);
								})
							}
						>
							<SelectTrigger className="h-8 w-[140px] bg-card **:data-[slot=select-value]:truncate">
								<SelectValue placeholder="Origen" />
							</SelectTrigger>
							<SelectContent>
								{sourceFilterOptions.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-1.5">
						<label className="text-muted-foreground text-xs font-medium">Pago</label>
						<Select
							items={paymentMethodFilterOptions}
							value={filters.paymentMethod}
							onValueChange={(value) =>
								startTransition(() => {
									void filters.setPaymentMethod(value);
								})
							}
						>
							<SelectTrigger className="h-8 w-[155px] bg-card [&_[data-slot=select-value]]:truncate">
								<SelectValue placeholder="Pago" />
							</SelectTrigger>
							<SelectContent>
								{paymentMethodFilterOptions.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-1.5">
						<label className="text-muted-foreground text-xs font-medium">Desde</label>
						<Popover>
							<PopoverTrigger
								render={
									<Button
										variant="outline"
										size="sm"
										data-empty={!fromDate}
										className="h-8 w-[145px] justify-start gap-1.5 bg-card font-normal data-[empty=true]:text-muted-foreground"
									>
										<HugeiconsIcon icon={Calendar01Icon} className="size-3.5 shrink-0" />
										{fromDate ? (
											format(fromDate, "d MMM yyyy", { locale: es })
										) : (
											<span>Seleccionar</span>
										)}
									</Button>
								}
							/>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="single"
									selected={fromDate}
									onSelect={(date) => {
										startTransition(() => {
											void filters.setFrom(date ? format(date, "yyyy-MM-dd") : null);
										});
									}}
									disabled={toDate ? { after: toDate } : undefined}
								/>
								{fromDate && (
									<div className="border-t p-2">
										<Button
											variant="ghost"
											size="sm"
											className="w-full text-muted-foreground"
											onClick={() => {
												startTransition(() => {
													void filters.setFrom(null);
												});
											}}
										>
											Limpiar
										</Button>
									</div>
								)}
							</PopoverContent>
						</Popover>
					</div>
					<div className="flex flex-col gap-1.5">
						<label className="text-muted-foreground text-xs font-medium">Hasta</label>
						<Popover>
							<PopoverTrigger
								render={
									<Button
										variant="outline"
										size="sm"
										data-empty={!toDate}
										className="h-8 w-[145px] justify-start gap-1.5 bg-card font-normal data-[empty=true]:text-muted-foreground"
									>
										<HugeiconsIcon icon={Calendar01Icon} className="size-3.5 shrink-0" />
										{toDate ? (
											format(toDate, "d MMM yyyy", { locale: es })
										) : (
											<span>Seleccionar</span>
										)}
									</Button>
								}
							/>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="single"
									selected={toDate}
									onSelect={(date) => {
										startTransition(() => {
											void filters.setTo(date ? format(date, "yyyy-MM-dd") : null);
										});
									}}
									disabled={fromDate ? { before: fromDate } : undefined}
								/>
								{toDate && (
									<div className="border-t p-2">
										<Button
											variant="ghost"
											size="sm"
											className="w-full text-muted-foreground"
											onClick={() => {
												startTransition(() => {
													void filters.setTo(null);
												});
											}}
										>
											Limpiar
										</Button>
									</div>
								)}
							</PopoverContent>
						</Popover>
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
							placeholder="Buscar por pedido o cliente…"
							value={localSearch}
							onChange={(event) => handleSearchChange(event.target.value)}
							className="w-full min-w-0 bg-card pl-9"
						/>
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-2 sm:ms-auto">
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
