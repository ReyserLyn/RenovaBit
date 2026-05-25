import {
	Bookmark01Icon,
	Delete01Icon,
	Edit01Icon,
	MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import { Checkbox } from "@renovabit/ui/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@renovabit/ui/components/ui/dropdown-menu";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import { Switch } from "@renovabit/ui/components/ui/switch";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import type { Brand } from "@/features/brands/model";
import type { Category } from "@/features/categories/model";
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header";
import type { Product, ProductStatus } from "../model";

const shortDateTimeFormatter = new Intl.DateTimeFormat("es", {
	dateStyle: "short",
	timeStyle: "short",
});

function formatShortDate(value: Date | string): string {
	const d = typeof value === "string" ? new Date(value) : value;
	if (Number.isNaN(d.getTime())) return "—";
	return shortDateTimeFormatter.format(d);
}

const statusConfig: Record<ProductStatus, { label: string; className: string }> = {
	active: { label: "Activo", className: "bg-success/10 text-success" },
	inactive: { label: "Inactivo", className: "bg-destructive/10 text-destructive" },
};

function formatPrice(value: string): string {
	try {
		return new Intl.NumberFormat("es-PE", {
			style: "currency",
			currency: "PEN",
			minimumFractionDigits: 2,
		}).format(Number(value));
	} catch {
		return `S/ ${value}`;
	}
}

// ── Sub-components for cells ─────────────────────────

function ProductImageCell({ row }: { row: { original: Product } }) {
	const imageUrls = row.original.imageUrls ?? [];
	const imageCount = row.original.imageCount ?? 0;
	const name = row.original.name;
	const [imgError, setImgError] = useState<Set<number>>(new Set());

	if (imageUrls.length === 0) {
		return (
			<div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs font-medium">
				{name.slice(0, 2).toUpperCase()}
			</div>
		);
	}

	const maxVisible = 2;
	const visibleUrls = imageUrls.slice(0, maxVisible);
	const remaining = imageCount - visibleUrls.length;

	// Stacking visual: capa superior (front) = primera imagen,
	// capa media = segunda imagen, capa inferior (back) = +N restantes

	return (
		<div className="flex items-center">
			{/* Render en orden inverso: lo último en el DOM queda arriba (front) */}
			{/* +N atrás (back) */}
			{remaining > 0 && (
				<div
					className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted text-[10px] font-medium text-muted-foreground"
					style={{ zIndex: 1, marginRight: -4 }}
				>
					+{remaining}
				</div>
			)}
			{/* Segunda imagen (medio) */}
			{visibleUrls.length > 1 && (
				<div
					className="relative h-9 w-9 overflow-hidden rounded-md border border-border"
					style={{ zIndex: 2, marginRight: -4 }}
				>
					{!imgError.has(1) ? (
						<img
							src={visibleUrls[1]}
							alt={`${name} 2`}
							loading="lazy"
							decoding="async"
							onError={() => setImgError((prev) => new Set(prev).add(1))}
							className="h-full w-full object-cover"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center bg-muted text-[8px] text-muted-foreground">
							{name.slice(0, 1)}
						</div>
					)}
				</div>
			)}
			{/* Primera imagen (front) */}
			{visibleUrls.length > 0 && (
				<div
					className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border bg-background shadow-sm"
					style={{ zIndex: 3 }}
				>
					{!imgError.has(0) ? (
						<img
							src={visibleUrls[0]}
							alt={`${name} 1`}
							loading="lazy"
							decoding="async"
							onError={() => setImgError((prev) => new Set(prev).add(0))}
							className="h-full w-full object-cover"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center bg-muted text-[8px] text-muted-foreground">
							{name.slice(0, 1)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// ── Column factory props ────────────────────────────

interface ProductColumnsProps {
	onEdit: (product: Product) => void;
	onDelete: (product: Product) => void;
	onToggleStatus: (product: Product, status: ProductStatus) => void;
	onToggleFeatured: (product: Product, isFeatured: boolean) => void;
	brandsById: Map<string, Brand>;
	categoriesById: Map<string, Category>;
}

// ── Column factory ──────────────────────────────────

export function getProductColumns({
	onEdit,
	onDelete,
	onToggleStatus,
	onToggleFeatured,
	brandsById,
	categoriesById,
}: ProductColumnsProps): ColumnDef<Product>[] {
	return [
		{
			id: "select",
			meta: {
				headerTitle: "Selección",
				skeleton: <Skeleton className="size-4 rounded-sm" />,
			},
			header: ({ table }) => {
				const isAllSelected = table.getIsAllPageRowsSelected();
				const isSomeSelected = table.getIsSomePageRowsSelected();

				return (
					<Checkbox
						checked={isAllSelected}
						data-state={isSomeSelected ? "indeterminate" : undefined}
						onCheckedChange={(value: boolean | "indeterminate") =>
							table.toggleAllPageRowsSelected(value === true)
						}
						aria-label="Seleccionar todas"
					/>
				);
			},
			cell: ({ row }) => (
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value: boolean | "indeterminate") => row.toggleSelected(value === true)}
					aria-label="Seleccionar fila"
				/>
			),
			enableSorting: false,
			enableHiding: false,
			size: 40,
		},
		{
			accessorKey: "imageUrls",
			meta: {
				headerTitle: "Imagen",
				skeleton: <Skeleton className="size-10 shrink-0 rounded-md" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Imagen" />,
			cell: ({ row }) => <ProductImageCell row={row} />,
			sortingFn: (rowA, rowB) => {
				const a = rowA.original.imageCount ?? 0;
				const b = rowB.original.imageCount ?? 0;
				return a - b;
			},
			size: 80,
		},
		{
			accessorKey: "name",
			meta: {
				headerTitle: "Nombre",
				skeleton: <Skeleton className="h-4 w-[min(100%,14rem)]" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Nombre" />,
			cell: ({ row }) => {
				const name = row.getValue<string>("name");
				const isActive = row.original.status === "active";
				return (
					<span className={`font-medium ${!isActive ? "text-muted-foreground" : ""}`}>{name}</span>
				);
			},
		},
		{
			accessorKey: "sku",
			meta: {
				headerTitle: "SKU",
				skeleton: <Skeleton className="h-4 w-20" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="SKU" />,
			cell: ({ row }) => (
				<span className="font-mono text-muted-foreground text-sm">{row.original.sku}</span>
			),
			size: 110,
		},
		{
			accessorKey: "price",
			meta: {
				headerTitle: "Precio",
				skeleton: <Skeleton className="h-4 w-20 tabular-nums" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Precio" />,
			cell: ({ row }) => (
				<span className="tabular-nums font-medium">{formatPrice(row.original.price)}</span>
			),
			size: 110,
		},
		{
			accessorKey: "stock",
			meta: {
				headerTitle: "Stock",
				skeleton: <Skeleton className="h-4 w-12 tabular-nums" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Stock" />,
			cell: ({ row }) => {
				const stock = row.getValue<number>("stock");
				const isLow = stock <= 5;

				return (
					<div className="flex items-center gap-1.5">
						<span
							className={`tabular-nums ${
								stock === 0
									? "text-destructive font-medium"
									: isLow
										? "text-warning font-medium"
										: "text-muted-foreground"
							}`}
						>
							{stock}
						</span>
						{stock === 0 && (
							<span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
								Sin stock
							</span>
						)}
					</div>
				);
			},
			size: 80,
		},
		{
			id: "brand",
			meta: {
				headerTitle: "Marca",
				skeleton: <Skeleton className="h-4 w-24" />,
			},
			accessorFn: (row) => (row.brandId ? (brandsById.get(row.brandId)?.name ?? "") : ""),
			header: ({ column }) => <DataGridColumnHeader column={column} title="Marca" />,
			cell: ({ row }) => {
				const brandId = row.original.brandId;
				if (!brandId) return <span className="text-muted-foreground text-sm">—</span>;
				const brand = brandsById.get(brandId);
				return (
					<span className="max-w-32 truncate text-sm" title={brand?.name}>
						{brand?.name ?? "—"}
					</span>
				);
			},
			size: 130,
		},
		{
			id: "category",
			meta: {
				headerTitle: "Categoría",
				skeleton: <Skeleton className="h-4 w-24" />,
			},
			accessorFn: (row) => (row.categoryId ? (categoriesById.get(row.categoryId)?.name ?? "") : ""),
			header: ({ column }) => <DataGridColumnHeader column={column} title="Categoría" />,
			cell: ({ row }) => {
				const categoryId = row.original.categoryId;
				if (!categoryId) return <span className="text-muted-foreground text-sm">—</span>;
				const category = categoriesById.get(categoryId);
				return (
					<span className="max-w-32 truncate text-sm" title={category?.name}>
						{category?.name ?? "—"}
					</span>
				);
			},
			size: 130,
		},
		{
			accessorKey: "status",
			meta: {
				headerTitle: "Estado",
				skeleton: <Skeleton className="h-5 w-20 rounded-full" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Estado" />,
			cell: ({ row }) => {
				const status = row.getValue<ProductStatus>("status");
				const config = statusConfig[status];

				return (
					<div className="flex items-center gap-2">
						<Switch
							checked={status === "active"}
							onCheckedChange={(checked) => {
								const nextStatus: ProductStatus = checked ? "active" : "inactive";
								onToggleStatus(row.original, nextStatus);
							}}
							aria-label={status === "active" ? "Desactivar producto" : "Activar producto"}
						/>
						<Badge className={config.className} variant="secondary">
							{config.label}
						</Badge>
					</div>
				);
			},
			size: 140,
		},
		{
			accessorKey: "isFeatured",
			meta: {
				headerTitle: "Destacado",
				skeleton: <Skeleton className="h-5 w-16 rounded-full" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Destacado" />,
			cell: ({ row }) => {
				const isFeatured = row.getValue<boolean>("isFeatured");

				if (!isFeatured) {
					return <span className="text-muted-foreground text-sm">—</span>;
				}

				return (
					<Badge className="bg-primary/10 text-primary" variant="secondary">
						Destacado
					</Badge>
				);
			},
			size: 100,
		},
		{
			id: "seo",
			meta: {
				headerTitle: "SEO",
				skeleton: <Skeleton className="h-5 w-20 rounded-full" />,
			},
			accessorFn: (row) => Boolean(row.seoTitle?.trim()) || Boolean(row.seoDescription?.trim()),
			header: ({ column }) => <DataGridColumnHeader column={column} title="SEO" />,
			cell: ({ row }) => {
				const hasSeo = row.getValue<boolean>("seo");

				if (!hasSeo) {
					return <span className="text-muted-foreground text-sm">—</span>;
				}

				return (
					<Badge className="bg-secondary text-secondary-foreground" variant="secondary">
						Configurado
					</Badge>
				);
			},
			size: 110,
		},
		{
			accessorKey: "createdAt",
			meta: {
				headerTitle: "Fecha de creación",
				skeleton: <Skeleton className="h-4 w-28 tabular-nums" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Fecha de creación" />,
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm tabular-nums">
					{formatShortDate(row.original.createdAt)}
				</span>
			),
			size: 140,
		},
		{
			accessorKey: "updatedAt",
			meta: {
				headerTitle: "Última edición",
				skeleton: <Skeleton className="h-4 w-28 tabular-nums" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Última edición" />,
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm tabular-nums">
					{formatShortDate(row.original.updatedAt)}
				</span>
			),
			size: 140,
		},
		{
			id: "actions",
			meta: {
				headerTitle: "Acciones",
				skeleton: <Skeleton className="mx-auto size-8 rounded-md" />,
			},
			header: () => null,
			cell: ({ row }) => {
				const product = row.original;

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
							<DropdownMenuItem onClick={() => onEdit(product)}>
								<HugeiconsIcon icon={Edit01Icon} className="mr-2 size-4" />
								Editar
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onToggleFeatured(product, !product.isFeatured)}>
								<HugeiconsIcon icon={Bookmark01Icon} className="mr-2 size-4" />
								{product.isFeatured ? "Quitar destacado" : "Destacar producto"}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => onDelete(product)}
								className="text-destructive focus:text-destructive"
							>
								<HugeiconsIcon icon={Delete01Icon} className="mr-2 size-4" />
								Eliminar
							</DropdownMenuItem>
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
