import { Badge } from "@renovabit/ui/components/ui/badge";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header";
import type { UserSummary } from "../model";

const shortDateFormatter = new Intl.DateTimeFormat("es", {
	dateStyle: "medium",
});

function formatDate(value: Date | string): string {
	const d = typeof value === "string" ? new Date(value) : value;
	if (Number.isNaN(d.getTime())) return "—";
	return shortDateFormatter.format(d);
}

// ── Role badge variants ────────────────────────────

const roleBadgeClasses: Record<string, string> = {
	admin: "bg-primary/10 text-primary",
	customer: "bg-secondary text-secondary-foreground",
	distributor: "bg-info/10 text-info",
};

const roleLabels: Record<string, string> = {
	admin: "Admin",
	customer: "Cliente",
	distributor: "Distribuidor",
};

// ── Columns ─────────────────────────────────────────

export function getUserColumns(): ColumnDef<UserSummary>[] {
	return [
		{
			accessorKey: "image",
			meta: {
				headerTitle: "Avatar",
				skeleton: <Skeleton className="size-9 shrink-0 rounded-full" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Avatar" />,
			cell: ({ row }) => {
				const image = row.getValue<string | null>("image");
				const name = row.original.name;
				const [imgError, setImgError] = useState(false);

				if (image && !imgError) {
					return (
						<img
							key={image}
							src={image}
							alt={name}
							loading="lazy"
							decoding="async"
							crossOrigin="anonymous"
							onError={() => setImgError(true)}
							className="size-9 rounded-full object-cover"
						/>
					);
				}

				return (
					<div
						role="img"
						aria-label={`Avatar de ${name}`}
						className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium"
					>
						{name.slice(0, 2).toUpperCase()}
					</div>
				);
			},
			sortingFn: (rowA, rowB) => {
				const a = Boolean(rowA.original.image);
				const b = Boolean(rowB.original.image);
				return Number(a) - Number(b);
			},
			size: 56,
		},
		{
			accessorKey: "name",
			meta: {
				headerTitle: "Nombre",
				skeleton: <Skeleton className="h-4 w-[min(100%,12rem)]" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Nombre" />,
			cell: ({ row }) => (
				<span className="font-medium text-sm">{row.getValue<string>("name")}</span>
			),
		},
		{
			accessorKey: "email",
			meta: {
				headerTitle: "Correo electrónico",
				skeleton: <Skeleton className="h-4 w-[min(100%,14rem)]" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Correo" />,
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm">{row.getValue<string>("email")}</span>
			),
		},
		{
			accessorKey: "displayUsername",
			meta: {
				headerTitle: "Nombre público",
				skeleton: <Skeleton className="h-4 w-[min(100%,8rem)]" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Nombre público" />,
			cell: ({ row }) => {
				const value = row.getValue<string | null>("displayUsername");
				return value ? (
					<span className="text-sm">{value}</span>
				) : (
					<span className="text-muted-foreground text-sm">—</span>
				);
			},
			size: 130,
		},
		{
			accessorKey: "username",
			meta: {
				headerTitle: "Usuario",
				skeleton: <Skeleton className="h-4 w-[min(100%,8rem)]" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Usuario" />,
			cell: ({ row }) => {
				const value = row.getValue<string | null>("username");
				return value ? (
					<span className="font-mono text-muted-foreground text-sm">{value}</span>
				) : (
					<span className="text-muted-foreground text-sm">—</span>
				);
			},
			size: 120,
		},
		{
			accessorKey: "phone",
			meta: {
				headerTitle: "Teléfono",
				skeleton: <Skeleton className="h-4 w-[min(100%,7rem)]" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Teléfono" />,
			cell: ({ row }) => {
				const value = row.getValue<string | null>("phone");
				return value ? (
					<span className="text-sm tabular-nums">{value}</span>
				) : (
					<span className="text-muted-foreground text-sm">—</span>
				);
			},
			size: 120,
		},
		{
			accessorKey: "role",
			meta: {
				headerTitle: "Rol",
				skeleton: <Skeleton className="h-5 w-20 rounded-full" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Rol" />,
			cell: ({ row }) => {
				const role = row.getValue<string>("role");
				const badgeClass = roleBadgeClasses[role] ?? "bg-muted text-muted-foreground";
				const label = roleLabels[role] ?? role;
				return (
					<Badge className={badgeClass} variant="secondary">
						{label}
					</Badge>
				);
			},
			size: 110,
		},
		{
			accessorKey: "emailVerified",
			meta: {
				headerTitle: "Email verificado",
				skeleton: <Skeleton className="h-5 w-20 rounded-full" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Verificado" />,
			cell: ({ row }) => {
				const verified = row.getValue<boolean>("emailVerified");
				return verified ? (
					<Badge className="bg-success/10 text-success" variant="secondary">
						Verificado
					</Badge>
				) : (
					<Badge className="bg-warning/10 text-warning" variant="secondary">
						Pendiente
					</Badge>
				);
			},
			size: 110,
		},
		{
			accessorKey: "createdAt",
			meta: {
				headerTitle: "Fecha de registro",
				skeleton: <Skeleton className="h-4 w-28" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Registro" />,
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm">{formatDate(row.original.createdAt)}</span>
			),
			size: 130,
		},
		{
			accessorKey: "updatedAt",
			meta: {
				headerTitle: "Última actividad",
				skeleton: <Skeleton className="h-4 w-28" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Última actividad" />,
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm">{formatDate(row.original.updatedAt)}</span>
			),
			size: 130,
		},
	];
}
