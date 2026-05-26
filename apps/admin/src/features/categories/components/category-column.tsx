import {
	Bookmark01Icon,
	Delete01Icon,
	Edit01Icon,
	EyeIcon,
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
import type { ColumnDef, Row } from "@tanstack/react-table";
import { useState } from "react";
import type { UserSummary } from "@/features/users/model";
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header";
import type { Category } from "../model";

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

interface CategoryColumnsProps {
	onEdit: (category: Category) => void;
	onDelete: (category: Category) => void;
	onToggleStatus: (category: Category, isActive: boolean) => void;
	onToggleFeatured: (category: Category, isFeatured: boolean) => void;
	onToggleNavVisibility: (category: Category, isVisibleInNav: boolean) => void;
	/** Mapa de id → nombre para resolver el padre */
	categoriesById: Map<string, Category>;
	usersById: Map<string, UserSummary>;
}

function CategoryLogoCell({ row }: { row: Row<Category> }) {
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
		<div
			role="img"
			aria-label={`Logo de ${name}`}
			className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs font-medium"
		>
			{name.slice(0, 2).toUpperCase()}
		</div>
	);
}

function CategoryNameCell({ row }: { row: Row<Category> }) {
	const name = row.getValue<string>("name");
	const active = row.original.isActive;
	return <span className={`font-medium ${!active ? "text-muted-foreground" : ""}`}>{name}</span>;
}

function CategoryParentCell({
	row,
	categoriesById,
}: {
	row: Row<Category>;
	categoriesById: Map<string, Category>;
}) {
	const parentId = row.original.parentId;
	if (!parentId) return <span className="text-muted-foreground text-sm">—</span>;
	const parent = categoriesById.get(parentId);
	return <span className="text-sm text-muted-foreground">{parent?.name ?? "—"}</span>;
}

export function getCategoryColumns({
	onEdit,
	onDelete,
	onToggleStatus,
	onToggleFeatured,
	onToggleNavVisibility,
	categoriesById,
	usersById,
}: CategoryColumnsProps): ColumnDef<Category>[] {
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
			cell: ({ row }) => <CategoryLogoCell row={row} />,
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
			cell: ({ row }) => <CategoryNameCell row={row} />,
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
					<Badge className="bg-secondary text-secondary-foreground" variant="secondary">
						Configurado
					</Badge>
				);
			},
			size: 110,
		},
		{
			id: "parent",
			accessorFn: (row) => row.path?.split("/").filter(Boolean).length ?? 0,
			meta: {
				headerTitle: "Categoría padre",
				skeleton: <Skeleton className="h-4 w-28" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Padre" />,
			cell: ({ row }) => <CategoryParentCell row={row} categoriesById={categoriesById} />,
			sortingFn: (rowA, rowB) => {
				const depthA = rowA.original.path?.split("/").filter(Boolean).length ?? 0;
				const depthB = rowB.original.path?.split("/").filter(Boolean).length ?? 0;
				if (depthA !== depthB) return depthA - depthB;
				// Misma profundidad: ordenar por nombre del padre (si tienen)
				const parentA = rowA.original.parentId
					? (categoriesById.get(rowA.original.parentId)?.name ?? "")
					: "";
				const parentB = rowB.original.parentId
					? (categoriesById.get(rowB.original.parentId)?.name ?? "")
					: "";
				return parentA.localeCompare(parentB);
			},
			size: 120,
		},
		{
			accessorKey: "sortOrder",
			meta: {
				headerTitle: "Orden",
				skeleton: <Skeleton className="h-4 w-8" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Orden" />,
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm tabular-nums">
					{row.original.sortOrder ?? 0}
				</span>
			),
			size: 70,
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
					return <span className="text-muted-foreground text-sm">—</span>;
				}
				return (
					<Badge className="bg-primary/10 text-primary" variant="secondary">
						Destacada
					</Badge>
				);
			},
			size: 100,
		},
		{
			accessorKey: "isVisibleInNav",
			meta: {
				headerTitle: "En navegación",
				skeleton: <Skeleton className="h-5 w-16 rounded-full" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="En navegación" />,
			cell: ({ row }) => {
				const isVisible = row.getValue<boolean>("isVisibleInNav");
				if (!isVisible) {
					return <span className="text-muted-foreground text-sm">—</span>;
				}
				return (
					<Badge className="bg-secondary text-secondary-foreground" variant="secondary">
						Visible
					</Badge>
				);
			},
			size: 110,
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
				const category = row.original;
				return (
					<div className="flex items-center gap-2">
						<Switch
							checked={isActive}
							onCheckedChange={(checked) => onToggleStatus(category, checked)}
							aria-label={isActive ? "Desactivar categoría" : "Activar categoría"}
						/>
						<Badge
							className={
								isActive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
							}
							variant="secondary"
						>
							{isActive ? "Activa" : "Inactiva"}
						</Badge>
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
			accessorKey: "createdBy",
			meta: {
				headerTitle: "Creado por",
				skeleton: (
					<div className="flex flex-col gap-1">
						<Skeleton className="h-3.5 w-24" />
						<Skeleton className="h-3 w-32" />
					</div>
				),
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Creado por" />,
			cell: ({ row }) => {
				const userId = row.original.createdBy;
				const user = userId ? usersById.get(userId) : undefined;
				return (
					<div className="flex flex-col">
						<span className="font-medium text-sm">{user?.name ?? "—"}</span>
						<span className="text-muted-foreground text-xs">{user?.email ?? "—"}</span>
					</div>
				);
			},
			size: 180,
		},
		{
			accessorKey: "updatedBy",
			meta: {
				headerTitle: "Actualizado por",
				skeleton: (
					<div className="flex flex-col gap-1">
						<Skeleton className="h-3.5 w-24" />
						<Skeleton className="h-3 w-32" />
					</div>
				),
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Actualizado por" />,
			cell: ({ row }) => {
				const userId = row.original.updatedBy;
				const user = userId ? usersById.get(userId) : undefined;
				return (
					<div className="flex flex-col">
						<span className="font-medium text-sm">{user?.name ?? "—"}</span>
						<span className="text-muted-foreground text-xs">{user?.email ?? "—"}</span>
					</div>
				);
			},
			size: 180,
		},
		{
			id: "actions",
			meta: {
				headerTitle: "Acciones",
				skeleton: <Skeleton className="mx-auto size-8 rounded-md" />,
			},
			header: () => null,
			cell: ({ row }) => {
				const category = row.original;
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
							<DropdownMenuItem onClick={() => onEdit(category)}>
								<HugeiconsIcon icon={Edit01Icon} className="mr-2 size-4" />
								Editar
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onToggleFeatured(category, !category.isFeatured)}>
								<HugeiconsIcon icon={Bookmark01Icon} className="mr-2 size-4" />
								{category.isFeatured ? "Quitar destacado" : "Destacar"}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => onToggleNavVisibility(category, !category.isVisibleInNav)}
							>
								<HugeiconsIcon icon={EyeIcon} className="mr-2 size-4" />
								{category.isVisibleInNav ? "Ocultar en navegación" : "Mostrar en navegación"}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => onDelete(category)}
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
