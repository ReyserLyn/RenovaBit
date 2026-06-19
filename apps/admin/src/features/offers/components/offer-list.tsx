import {
	Delete01Icon,
	Edit01Icon,
	MoreHorizontalIcon,
	Package01Icon,
	ReloadIcon,
	Search01Icon,
	Settings02Icon,
	ToggleOffIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import { Card } from "@renovabit/ui/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@renovabit/ui/components/ui/dropdown-menu";
import { Input } from "@renovabit/ui/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import {
	type ColumnDef,
	getCoreRowModel,
	type PaginationState,
	useReactTable,
} from "@tanstack/react-table";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridColumnVisibility } from "@/shared/components/data-grid/data-grid-column-visibility";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import { offerKeys, useOfferFilters, useOffers } from "../hooks";
import type { OfferListItem } from "../service/offers.service";
import { OfferFiltersBar } from "./offer-filters";

// ── Core row model ──

const coreRowModel = getCoreRowModel();

// ── Props ──

interface OfferListProps {
	onEdit: (offer: OfferListItem) => void;
	onViewProducts: (offer: OfferListItem) => void;
	onDelete: (offer: OfferListItem) => void;
	onToggleActive: (offer: OfferListItem) => void;
}

// ── Columns ──

function getColumns(props: {
	onEdit: (offer: OfferListItem) => void;
	onViewProducts: (offer: OfferListItem) => void;
	onDelete: (offer: OfferListItem) => void;
	onToggleActive: (offer: OfferListItem) => void;
}): ColumnDef<OfferListItem>[] {
	return [
		{
			accessorKey: "name",
			header: "Nombre",
			cell: ({ row }) => <span className="text-sm font-medium">{row.original.name}</span>,
		},
		{
			accessorKey: "discountValue",
			header: "Descuento",
			cell: ({ row }) => (
				<span className="font-mono tabular-nums text-sm">{`-${row.original.discountValue}%`}</span>
			),
		},
		{
			accessorKey: "productCount",
			header: "Productos",
			cell: ({ row }) => (
				<span className="font-mono tabular-nums text-sm">
					{row.original.productCount?.toString() ?? "0"}
				</span>
			),
		},
		{
			accessorKey: "isActive",
			header: "Estado",
			cell: ({ row }) => (
				<Badge variant={row.original.isActive ? "success" : "secondary"} size="xs">
					{row.original.isActive ? "Activo" : "Inactivo"}
				</Badge>
			),
		},
		{
			accessorKey: "isFeatured",
			header: "Destacada",
			cell: ({ row }) =>
				row.original.isFeatured ? (
					<Badge variant="warning" size="xs">
						Sí
					</Badge>
				) : (
					<span className="text-muted-foreground text-sm">No</span>
				),
		},
		{
			accessorKey: "createdAt",
			header: "Creado",
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm">
					{new Date(row.original.createdAt).toLocaleDateString()}
				</span>
			),
		},
		{
			id: "actions",
			meta: {
				headerTitle: "Acciones",
			},
			header: () => null,
			cell: ({ row }) => {
				const offer = row.original;
				return (
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button variant="ghost" size="icon-sm" className="h-8 w-8">
									<span className="sr-only">Abrir menú</span>
									<HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
								</Button>
							}
						/>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => props.onEdit(offer)}>
								<HugeiconsIcon icon={Edit01Icon} className="mr-2 size-4" />
								Editar
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => props.onViewProducts(offer)}>
								<HugeiconsIcon icon={Package01Icon} className="mr-2 size-4" />
								Ver productos
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							{offer.isActive ? (
								<DropdownMenuItem
									onClick={() => props.onDelete(offer)}
									className="text-destructive focus:text-destructive"
								>
									<HugeiconsIcon icon={Delete01Icon} className="mr-2 size-4" />
									Eliminar
								</DropdownMenuItem>
							) : (
								<DropdownMenuItem onClick={() => props.onToggleActive(offer)}>
									<HugeiconsIcon icon={ToggleOffIcon} className="mr-2 size-4" />
									Activar
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				);
			},
			enableSorting: false,
			enableHiding: false,
			size: 50,
		},
	];
}

// ── Component ──

export function OfferList({ onEdit, onViewProducts, onDelete, onToggleActive }: OfferListProps) {
	const queryClient = useQueryClient();
	const filters = useOfferFilters();

	// Build API query params from filters + pagination
	const apiFilters = useMemo(() => {
		const params: Record<string, string> = {};
		if (filters.search) params.search = filters.search;
		if (filters.isActive && filters.isActive !== "all") params.isActive = filters.isActive;
		if (filters.isFeatured && filters.isFeatured !== "all") params.isFeatured = filters.isFeatured;
		if (filters.from) params.from = filters.from;
		if (filters.to) params.to = filters.to;
		params.offset = String(filters.page * filters.pageSize);
		params.limit = String(filters.pageSize);
		return params;
	}, [
		filters.search,
		filters.isActive,
		filters.isFeatured,
		filters.from,
		filters.to,
		filters.page,
		filters.pageSize,
	]);

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
					void filters.setPage(0);
				});
			}, 300);
		},
		[filters.setSearch, filters.setPage],
	);

	useEffect(() => {
		return () => clearTimeout(searchTimerRef.current);
	}, []);

	const {
		data: response,
		isPending,
		isFetching,
		isError,
		error,
	} = useOffers(Object.keys(apiFilters).length > 0 ? apiFilters : undefined);
	const offers = response?.data ?? [];
	const total = response?.total ?? 0;

	const columns = useMemo(
		() => getColumns({ onEdit, onViewProducts, onDelete, onToggleActive }),
		[onEdit, onViewProducts, onDelete, onToggleActive],
	);

	// Server-side pagination state from URL filters
	const pagination = useMemo<PaginationState>(
		() => ({
			pageIndex: filters.page,
			pageSize: filters.pageSize,
		}),
		[filters.page, filters.pageSize],
	);

	const pageCount = useMemo(() => Math.ceil(total / filters.pageSize), [total, filters.pageSize]);

	const handlePaginationChange = useCallback(
		(updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
			const next = typeof updater === "function" ? updater(pagination) : updater;
			void filters.setPage(next.pageIndex);
			if (next.pageSize !== filters.pageSize) {
				void filters.setPageSize(next.pageSize);
				void filters.setPage(0);
			}
		},
		[filters, pagination],
	);

	const table = useReactTable({
		data: offers,
		columns,
		state: { pagination },
		onPaginationChange: handlePaginationChange,
		getCoreRowModel: coreRowModel,
		manualPagination: true,
		pageCount,
		getRowId: (row) => row.id,
	});

	const handleRefresh = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: offerKeys.all });
	}, [queryClient]);

	return (
		<div className="flex flex-col gap-4">
			{isError ? (
				<div className="bg-destructive/5 border-destructive/40 flex flex-col items-start gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-sm">
						No se pudieron cargar las ofertas.
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
						placeholder="Filtrar por nombre…"
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

			<OfferFiltersBar filters={filters} />

			<Card className="gap-0 overflow-hidden py-0 shadow-sm">
				<DataGrid
					table={table}
					recordCount={total}
					isLoading={isPending}
					emptyMessage="No hay ofertas aún. Crea la primera oferta para empezar."
					loadingMessage="Cargando ofertas…"
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

						{!isPending && total > 0 ? (
							<div className="border-border border-t bg-muted/30">
								<DataGridPagination info="Mostrando {from}-{to} de {count}" />
							</div>
						) : null}
					</div>
				</DataGrid>
			</Card>
		</div>
	);
}
