import { Badge } from "@renovabit/ui/components/ui/badge";
import { Link } from "@tanstack/react-router";
import type { ReportChange } from "@/features/reports/model";
import { CHANGE_LABELS, formatChangeValue } from "@/features/reports/model";
import { formatDateTimeSeconds } from "@/shared/lib/format-date";

export function ChangeRow({ change }: { change: ReportChange }) {
	const info = CHANGE_LABELS[change.changeType] ?? {
		label: change.changeType,
		variant: "info" as const,
	};

	return (
		<Link
			to="/historial"
			search={{ producto: change.productId }}
			className="flex items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0 hover:bg-muted/30 cursor-pointer no-underline text-inherit"
		>
			<Badge variant={info.variant} size="sm" className="shrink-0 w-18 justify-center">
				{info.label}
			</Badge>

			<div className="flex-1 min-w-0">
				<span className="font-medium truncate block">{change.productName}</span>
				<span className="text-muted-foreground text-xs">{change.productSku}</span>
			</div>

			{change.oldValue !== null || change.newValue !== null ? (
				<span className="text-xs text-muted-foreground shrink-0 tabular-nums">
					{formatChangeValue(change.oldValue, change.newValue)}
				</span>
			) : (
				<span className="text-muted-foreground text-xs shrink-0">{change.reason ?? "—"}</span>
			)}

			<span className="text-muted-foreground text-xs tabular-nums shrink-0 w-32 text-right">
				{formatDateTimeSeconds(change.createdAt)}
			</span>
		</Link>
	);
}
