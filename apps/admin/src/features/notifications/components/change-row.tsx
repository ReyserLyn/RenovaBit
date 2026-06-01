import { Badge } from "@renovabit/ui/components/ui/badge";
import type { ReportChange } from "@/features/reports/service/reports.service";
import { formatDateTimeSeconds } from "@/shared/lib/format-date";
import { CHANGE_LABELS } from "../model";

function formatOldNew(oldVal: unknown, newVal: unknown, changeType: string): string {
	const fmt = (v: unknown) => {
		if (v === null || v === undefined) return "—";
		if (typeof v === "object") {
			const o = v as Record<string, unknown>;
			if ("price" in o) return `S/ ${o.price}`;
			if ("stock" in o) return String(o.stock);
			return JSON.stringify(o);
		}
		return String(v);
	};
	return `${fmt(oldVal)} → ${fmt(newVal)}`;
}

export function ChangeRow({ change }: { change: ReportChange }) {
	const info = CHANGE_LABELS[change.changeType] ?? {
		label: change.changeType,
		variant: "info" as const,
	};

	return (
		<a
			href={`/historial?producto=${change.productId}`}
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
					{formatOldNew(change.oldValue, change.newValue, change.changeType)}
				</span>
			) : (
				<span className="text-muted-foreground text-xs shrink-0">{change.reason ?? "—"}</span>
			)}

			<span className="text-muted-foreground text-xs tabular-nums shrink-0 w-32 text-right">
				{formatDateTimeSeconds(change.createdAt)}
			</span>
		</a>
	);
}
