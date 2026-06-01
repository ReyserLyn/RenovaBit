import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGridColumnHeader } from "@/shared/components/data-grid/data-grid-column-header";
import { formatDateTime } from "@/shared/lib/format-date";
import type { AppNotification, NotificationData } from "../model";
import { TriggerBadge } from "./trigger-badge";

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
					{formatDateTime(row.original.createdAt)}
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
			cell: ({ row }) => <TriggerBadge trigger={row.original._parsed.trigger} />,
			size: 120,
		},
	];
}
