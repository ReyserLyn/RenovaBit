import { Badge } from "@renovabit/ui/components/ui/badge";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header";
import type { AppNotification, NotificationData } from "../model";

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
	day: "2-digit",
	month: "short",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

function formatDate(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? "—" : dateFormatter.format(d);
}

export function getNotificationColumns(): ColumnDef<
	AppNotification & { _parsed: NotificationData }
>[] {
	return [
		{
			id: "status",
			meta: { headerTitle: "Estado", skeleton: <Skeleton className="size-2 rounded-full" /> },
			header: () => <span className="sr-only">Estado</span>,
			cell: ({ row }) =>
				!row.original.isRead ? (
					<span className="flex size-2 rounded-full bg-primary" aria-label="No leída" />
				) : null,
			enableSorting: false,
			size: 30,
		},
		{
			accessorKey: "createdAt",
			meta: {
				headerTitle: "Fecha",
				skeleton: <Skeleton className="h-4 w-32" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Fecha" />,
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm whitespace-nowrap tabular-nums">
					{formatDate(row.original.createdAt)}
				</span>
			),
			size: 180,
		},
		{
			accessorKey: "title",
			meta: {
				headerTitle: "Título",
				skeleton: <Skeleton className="h-4 w-48" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Título" />,
			cell: ({ row }) => (
				<span className={!row.original.isRead ? "font-semibold" : "font-medium"}>
					{row.original.title}
				</span>
			),
		},
		{
			id: "trigger",
			accessorFn: (row) => row._parsed.trigger ?? null,
			meta: {
				headerTitle: "Tipo",
				skeleton: <Skeleton className="h-5 w-20 rounded-full" />,
			},
			header: ({ column }) => <DataGridColumnHeader column={column} title="Tipo" />,
			cell: ({ row }) => {
				const trigger = row.original._parsed.trigger;
				if (!trigger) return <span className="text-muted-foreground text-sm">—</span>;

				const variant = trigger === "manual" ? ("warning" as const) : ("info" as const);
				const label = trigger === "manual" ? "Manual" : "Automático";
				return (
					<Badge variant={variant} size="sm">
						{label}
					</Badge>
				);
			},
			size: 120,
		},
	];
}
