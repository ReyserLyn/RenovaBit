import {
	Bookmark01Icon,
	Delete01Icon,
	Edit01Icon,
	MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header";
import type { Brand } from "../model";

const shortDateTimeFormatter = new Intl.DateTimeFormat("es", {
	dateStyle: "short",
	timeStyle: "short",
});

function formatShortDate(value: Date | string): string {
	const d = typeof value === "string" ? new Date(value) : value;
	if (Number.isNaN(d.getTime())) {
		return "—";
	}
	return shortDateTimeFormatter.format(d);
}

interface BrandColumnsProps {
	onEdit: (brand: Brand) => void;
	onDelete: (brand: Brand) => void;
	onToggleStatus: (brand: Brand, isActive: boolean) => void;
	onToggleFeatured: (brand: Brand, isFeatured: boolean) => void;
}

export function getBrandColumns({
	onEdit,
	onDelete,
	onToggleStatus,
	onToggleFeatured,
}: BrandColumnsProps): ColumnDef<Brand>[] {
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
			accessorKey: "imageUrl",
			meta: {
				headerTitle: "Logo",
				skeleton: <Skeleton className="size-10 shrink-0 rounded-md" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Logo" />,
			cell: ({ row }) => {
				const imageUrl = row.getValue<string | null>("imageUrl");
				const name = row.original.name;
				const [imgError, setImgError] = useState(false);

				if (imageUrl && !imgError) {
					return (
						<img
							key={imageUrl}
							src={imageUrl}
							alt={name}
							loading="lazy"
							decoding="async"
							crossOrigin="anonymous"
							onError={() => setImgError(true)}
							className="h-10 w-10 rounded-md object-contain"
						/>
					);
				}

				return (
					<div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs font-medium">
						{name.slice(0, 2).toUpperCase()}
					</div>
				);
			},
			sortingFn: (rowA, rowB) => {
				const a = Boolean(rowA.original.imageUrl);
				const b = Boolean(rowB.original.imageUrl);
				return Number(a) - Number(b);
			},
			size: 60,
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
				const active = row.original.isActive;

				return (
					<span className={`font-medium ${!active ? "text-muted-foreground" : ""}`}>{name}</span>
				);
			},
		},
		{
			accessorKey: "slug",
			meta: {
				headerTitle: "Slug",
				skeleton: <Skeleton className="h-4 w-[min(100%,9rem)]" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Slug" />,
			cell: ({ row }) => (
				<span className="font-mono text-muted-foreground max-w-40 truncate text-sm">
					{row.original.slug}
				</span>
			),
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
					<span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
						Configurado
					</span>
				);
			},
			size: 110,
		},
		{
			accessorKey: "description",
			meta: {
				headerTitle: "Descripción",
				skeleton: <Skeleton className="h-4 w-[min(100%,18rem)]" />,
			},
			header: "Descripción",
			cell: ({ row }) => {
				const description = row.getValue<string | null>("description");

				if (!description) {
					return <span className="text-muted-foreground text-sm">Sin descripción</span>;
				}

				return (
					<span className="max-w-sm truncate text-sm" title={description}>
						{description}
					</span>
				);
			},
		},
		{
			accessorKey: "isActive",
			meta: {
				headerTitle: "Estado",
				skeleton: (
					<div className="flex items-center gap-2">
						<Skeleton className="h-5 w-9 rounded-full" />
						<Skeleton className="h-4 w-14" />
					</div>
				),
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Estado" />,
			cell: ({ row }) => {
				const isActive = row.getValue<boolean>("isActive");
				const brand = row.original;

				return (
					<div className="flex items-center gap-2">
						<Switch
							checked={isActive}
							onCheckedChange={(checked) => onToggleStatus(brand, checked)}
							aria-label={isActive ? "Desactivar marca" : "Activar marca"}
						/>
						<span className={`text-sm ${isActive ? "text-green-600" : "text-muted-foreground"}`}>
							{isActive ? "Activa" : "Inactiva"}
						</span>
					</div>
				);
			},
			size: 120,
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
			accessorKey: "isFeatured",
			meta: {
				headerTitle: "Destacada",
				skeleton: <Skeleton className="h-5 w-16 rounded-full" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Destacada" />,
			cell: ({ row }) => {
				const isFeatured = row.getValue<boolean>("isFeatured");

				if (!isFeatured) {
					return <span className="text-muted-foreground text-sm">-</span>;
				}

				return (
					<span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
						Destacada
					</span>
				);
			},
			size: 100,
		},
		{
			id: "actions",
			meta: {
				headerTitle: "Acciones",
				skeleton: <Skeleton className="mx-auto size-8 rounded-md" />,
			},
			header: () => null,
			cell: ({ row }) => {
				const brand = row.original;

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
							<DropdownMenuItem onClick={() => onEdit(brand)}>
								<HugeiconsIcon icon={Edit01Icon} className="mr-2 size-4" />
								Editar
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onToggleFeatured(brand, !brand.isFeatured)}>
								<HugeiconsIcon icon={Bookmark01Icon} className="mr-2 size-4" />
								{brand.isFeatured ? "Quitar destacado" : "Destacar marca"}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => onDelete(brand)}
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
