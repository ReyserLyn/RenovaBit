import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import { Checkbox } from "@renovabit/ui/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@renovabit/ui/components/ui/dialog";
import { Input } from "@renovabit/ui/components/ui/input";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import {
	type ColumnDef,
	type ColumnFiltersState,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type RowSelectionState,
	useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useCategories } from "@/features/categories/hooks";
import { DataGrid, DataGridContainer } from "@/shared/components/data-grid/data-grid";
import { DataGridPagination } from "@/shared/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/shared/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/shared/components/data-grid/data-grid-table";

// ── Core row models ──

const coreRowModel = getCoreRowModel();
const filteredRowModel = getFilteredRowModel();
const sortedRowModel = getSortedRowModel();
const paginationRowModel = getPaginationRowModel();

// ── Props ──

interface CategoryPickerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedIds: string[];
	onSelectionChange: (ids: string[]) => void;
}

// ── Picker columns ──

function getPickerColumns(): ColumnDef<{
	id: string;
	name: string;
	isActive: boolean;
	slug: string;
}>[] {
	return [
		{
			id: "select",
			header: ({ table }) => (
				<Checkbox
					checked={table.getIsAllPageRowsSelected()}
					indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
					onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
					aria-label="Seleccionar todas"
				/>
			),
			cell: ({ row }) => (
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value) => row.toggleSelected(!!value)}
					aria-label={`Seleccionar ${row.original.name}`}
				/>
			),
			enableSorting: false,
			enableHiding: false,
			size: 40,
		},
		{
			accessorKey: "name",
			header: "Categoría",
			cell: ({ row }) => (
				<div className="flex flex-col">
					<span className="text-sm font-medium">{row.original.name}</span>
					<span className="text-muted-foreground font-mono text-xs">{row.original.slug}</span>
				</div>
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
	];
}

// ── Component ──

export function CategoryPicker({
	open,
	onOpenChange,
	selectedIds,
	onSelectionChange,
}: CategoryPickerProps) {
	const { data: categoriesData, isPending } = useCategories();
	const categories = categoriesData ?? [];

	const [pagination, setPagination] = useState<PaginationState>(() => ({
		pageIndex: 0,
		pageSize: 10,
	}));
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>(() => {
		const selection: RowSelectionState = {};
		for (const id of selectedIds) {
			selection[id] = true;
		}
		return selection;
	});

	const columns = useMemo(() => getPickerColumns(), []);

	const table = useReactTable({
		data: categories,
		columns,
		state: { pagination, columnFilters, rowSelection },
		onPaginationChange: setPagination,
		onColumnFiltersChange: setColumnFilters,
		onRowSelectionChange: setRowSelection,
		getCoreRowModel: coreRowModel,
		getFilteredRowModel: filteredRowModel,
		getSortedRowModel: sortedRowModel,
		getPaginationRowModel: paginationRowModel,
		getRowId: (row) => row.id,
		enableRowSelection: true,
	});

	const handleConfirm = () => {
		const ids = Object.keys(rowSelection).filter((id) => rowSelection[id]);
		onSelectionChange(ids);
		onOpenChange(false);
	};

	const handleOpenChange = (openNext: boolean) => {
		if (!openNext) {
			setRowSelection(() => {
				const selection: RowSelectionState = {};
				for (const id of selectedIds) {
					selection[id] = true;
				}
				return selection;
			});
		}
		onOpenChange(openNext);
	};

	const filteredCount = table.getFilteredRowModel().rows.length;

	const nameFilterValue = table.getColumn("name")?.getFilterValue();
	const searchValue = typeof nameFilterValue === "string" ? nameFilterValue : "";

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-2xl p-0 gap-0 max-h-[85dvh] flex flex-col overflow-hidden">
				<DialogHeader className="shrink-0 p-4">
					<DialogTitle>Seleccionar categorías</DialogTitle>
					<DialogDescription>
						{Object.keys(rowSelection).filter((id) => rowSelection[id]).length > 0
							? `${Object.keys(rowSelection).filter((id) => rowSelection[id]).length} categoría(s) seleccionada(s)`
							: "Selecciona las categorías que deseas incluir."}
					</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
					<div className="flex flex-col gap-4">
						{/* Search */}
						<div className="relative w-full">
							<HugeiconsIcon
								icon={Search01Icon}
								className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								placeholder="Buscar categorías…"
								value={searchValue}
								onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
								className="w-full bg-card pl-9"
							/>
						</div>

						{isPending ? (
							<div className="flex flex-col gap-2">
								<Skeleton className="h-8 w-full" />
								<Skeleton className="h-8 w-full" />
								<Skeleton className="h-8 w-full" />
								<Skeleton className="h-8 w-3/4" />
							</div>
						) : (
							<DataGrid
								table={table}
								recordCount={filteredCount}
								isLoading={false}
								emptyMessage="No hay categorías disponibles."
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

									{filteredCount > 0 ? (
										<div className="border-border border-t bg-muted/30">
											<DataGridPagination />
										</div>
									) : null}
								</div>
							</DataGrid>
						)}
					</div>
				</div>

				<DialogFooter
					className="mx-0 mb-0 shrink-0 px-4 pb-4"
					showCloseButton
					closeLabel="Cancelar"
				>
					<Button type="button" onClick={handleConfirm}>
						Confirmar selección
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
