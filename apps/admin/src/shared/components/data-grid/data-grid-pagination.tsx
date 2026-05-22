import {
	ArrowLeft01Icon,
	ArrowLeftDoubleIcon,
	ArrowRight01Icon,
	ArrowRightDoubleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@renovabit/ui/components/ui/select";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import { cn } from "@renovabit/ui/lib/utils";
import React, { ReactNode } from "react";
import { useDataGrid } from "./data-grid";

interface DataGridPaginationProps {
	sizes?: number[];
	sizesSkeleton?: ReactNode;
	info?: string;
	infoSkeleton?: ReactNode;
	className?: string;
	rowsPerPageLabel?: string;
	selectionInfo?: string;
}

function DataGridPagination(props: DataGridPaginationProps): React.JSX.Element {
	const { table, recordCount, isLoading } = useDataGrid();

	const defaultProps: Partial<DataGridPaginationProps> = {
		sizes: [10, 20, 25, 30, 40, 50],
		sizesSkeleton: <Skeleton className="h-8 w-44" />,
		info: "Página {page} de {pageCount}",
		infoSkeleton: <Skeleton className="h-8 w-28" />,
		rowsPerPageLabel: "Filas por página",
	};

	const mergedProps: DataGridPaginationProps = { ...defaultProps, ...props };

	const pageIndex = table.getState().pagination.pageIndex;
	const pageSize = table.getState().pagination.pageSize;
	const pageCount = table.getPageCount();
	const page = pageIndex + 1;
	const from = recordCount === 0 ? 0 : pageIndex * pageSize + 1;
	const to = Math.min((pageIndex + 1) * pageSize, recordCount);
	const canPrev = table.getCanPreviousPage();
	const canNext = table.getCanNextPage();

	// Replace placeholders in paginationInfo
	const paginationInfo = mergedProps?.info
		? mergedProps.info
				.replace("{from}", from.toString())
				.replace("{to}", to.toString())
				.replace("{count}", recordCount.toString())
				.replace("{page}", page.toString())
				.replace("{pageCount}", pageCount.toString())
		: `${from} - ${to} of ${recordCount}`;

	return (
		<div
			data-slot="data-grid-pagination"
			className={cn("flex items-center justify-between px-4 py-2", mergedProps?.className)}
		>
			{/* Selection info — izquierda */}
			<div className="text-muted-foreground flex-1 text-sm">{mergedProps.selectionInfo}</div>

			{/* Controles — derecha */}
			<div className="flex items-center gap-2">
				{isLoading ? (
					mergedProps?.sizesSkeleton
				) : (
					<>
						{/* Rows per page */}
						<div className="flex items-center space-x-2">
							<p className="text-sm font-medium">{mergedProps.rowsPerPageLabel}</p>
							<Select
								value={`${pageSize}`}
								onValueChange={(value) => {
									table.setPageSize(Number(value));
								}}
							>
								<SelectTrigger className="h-8 w-[70px]">
									<SelectValue placeholder={pageSize} />
								</SelectTrigger>
								<SelectContent side="top">
									{mergedProps?.sizes?.map((size: number) => (
										<SelectItem key={size} value={`${size}`}>
											{size}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Page info text */}
						{isLoading ? (
							mergedProps?.infoSkeleton
						) : (
							<span className="text-sm font-medium text-nowrap">{paginationInfo}</span>
						)}

						{/* Navigation buttons */}
						<div className="flex items-center space-x-1">
							<Button
								variant="outline"
								size="icon"
								className="hidden size-8 lg:flex"
								onClick={() => table.setPageIndex(0)}
								disabled={!canPrev}
								aria-label="Primera página"
							>
								<HugeiconsIcon icon={ArrowLeftDoubleIcon} className="size-4" />
							</Button>
							<Button
								variant="outline"
								size="icon"
								className="size-8"
								onClick={() => table.previousPage()}
								disabled={!canPrev}
								aria-label="Página anterior"
							>
								<HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
							</Button>
							<Button
								variant="outline"
								size="icon"
								className="size-8"
								onClick={() => table.nextPage()}
								disabled={!canNext}
								aria-label="Siguiente página"
							>
								<HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
							</Button>
							<Button
								variant="outline"
								size="icon"
								className="hidden size-8 lg:flex"
								onClick={() => table.setPageIndex(pageCount - 1)}
								disabled={!canNext}
								aria-label="Última página"
							>
								<HugeiconsIcon icon={ArrowRightDoubleIcon} className="size-4" />
							</Button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

export { DataGridPagination, type DataGridPaginationProps };
