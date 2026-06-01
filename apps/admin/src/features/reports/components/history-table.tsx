import { Search01Icon } from "@hugeicons/core-free-icons";
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
import {
	type ColumnFiltersState,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";
import type { ProductChange } from "../service/reports.service";
import { getHistoryColumns } from "./history-columns";

interface HistoryTableProps {
	changes: ProductChange[];
	isPending: boolean;
}

const TYPE_OPTIONS = [
	{ label: "Todos", value: "all" },
	{ label: "Precio", value: "price_changed" },
	{ label: "Stock", value: "stock_changed" },
	{ label: "Creado", value: "created" },
	{ label: "Sin stock", value: "out_of_stock" },
];

const coreRowModel = getCoreRowModel();
const filteredRowModel = getFilteredRowModel();
const sortedRowModel = getSortedRowModel();
const paginationRowModel = getPaginationRowModel();

export function HistoryTable({ changes, isPending }: HistoryTableProps) {
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 });
	const [globalFilter, setGlobalFilter] = useState("");
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

	const columns = useMemo(() => getHistoryColumns(), []);

	// Sync type filter with columnFilters
	const typeFilter = columnFilters.find((f) => f.id === "changeType")?.value as string | undefined;

	const handleTypeChange = (value: string | null) => {
		const next = value ?? "all";
		if (next === "all") {
			setColumnFilters((prev) => prev.filter((f) => f.id !== "changeType"));
		} else {
			setColumnFilters((prev) => [
				...prev.filter((f) => f.id !== "changeType"),
				{ id: "changeType", value: next },
			]);
		}
	};

	// Reset pagination on filter change
	useEffect(() => {
		setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
	}, [columnFilters, globalFilter]);

	const table = useReactTable({
		data: changes,
		columns,
		state: {
			pagination,
			globalFilter,
			columnFilters,
		},
		onPaginationChange: setPagination,
		onGlobalFilterChange: setGlobalFilter,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: coreRowModel,
		getFilteredRowModel: filteredRowModel,
		getSortedRowModel: sortedRowModel,
		getPaginationRowModel: paginationRowModel,
		globalFilterFn: (row, _, filterValue) => {
			const search = String(filterValue).toLowerCase().trim();
			if (!search) return true;
			const c = row.original;
			return (
				String(c.reportTrigger ?? "")
					.toLowerCase()
					.includes(search) ||
				String(c.reason ?? "")
					.toLowerCase()
					.includes(search) ||
				String(c.createdAt).toLowerCase().includes(search)
			);
		},
		getRowId: (row) => row.id,
	});

	const totalCount = changes.length;
	const filteredCount = table.getFilteredRowModel().rows.length;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1.5">
					<label className="text-muted-foreground text-xs font-medium">Tipo</label>
					<Select items={TYPE_OPTIONS} value={typeFilter ?? "all"} onValueChange={handleTypeChange}>
						<SelectTrigger className="h-8 w-[140px]">
							<SelectValue placeholder="Todos" />
						</SelectTrigger>
						<SelectContent>
							{TYPE_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="relative w-full min-w-0 sm:max-w-sm">
					<HugeiconsIcon
						icon={Search01Icon}
						className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						placeholder="Filtrar…"
						value={globalFilter}
						onChange={(e) => setGlobalFilter(e.target.value)}
						className="h-8 w-full min-w-0 bg-card pl-9"
					/>
				</div>

				{typeFilter && typeFilter !== "all" && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 text-xs"
						onClick={() => handleTypeChange("all")}
					>
						Limpiar tipo
					</Button>
				)}
			</div>

			<Card className="gap-0 overflow-hidden py-0 shadow-sm">
				<DataGrid
					table={table}
					recordCount={filteredCount}
					isLoading={isPending}
					emptyMessage="No se encontraron cambios."
					loadingMessage="Cargando cambios…"
					tableLayout={{
						cellBorder: false,
						rowBorder: true,
						stripped: false,
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

						{!isPending && totalCount > 0 && (
							<div className="border-border border-t bg-muted/30">
								<DataGridPagination selectionInfo={`${totalCount} cambios`} />
							</div>
						)}
					</div>
				</DataGrid>
			</Card>
		</div>
	);
}
