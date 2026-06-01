import { Badge } from "@renovabit/ui/components/ui/badge";

export function TriggerBadge({ trigger }: { trigger?: string | null }) {
	if (!trigger) return null;
	const variant = trigger === "manual" ? ("warning" as const) : ("info" as const);
	const label = trigger === "manual" ? "Manual" : "Automático";
	return (
		<Badge variant={variant} size="sm">
			{label}
		</Badge>
	);
}
