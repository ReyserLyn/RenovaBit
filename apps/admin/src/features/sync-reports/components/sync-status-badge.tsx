import { Badge } from "@renovabit/ui/components/ui/badge";

type StatusMeta = {
	label: string;
	variant: "info" | "success" | "destructive" | "secondary";
};

const STATUS_META: Record<string, StatusMeta> = {
	running: { label: "En curso", variant: "info" },
	completed: { label: "Completado", variant: "success" },
	failed: { label: "Fallido", variant: "destructive" },
};

export function SyncStatusBadge({ status }: { status: string }) {
	const meta = STATUS_META[status] ?? { label: status, variant: "secondary" as const };

	return (
		<Badge variant={meta.variant} size="sm">
			{meta.label}
		</Badge>
	);
}
