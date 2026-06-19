import { Badge } from "@renovabit/ui/components/ui/badge";
import { Card } from "@renovabit/ui/components/ui/card";
import { cn } from "@renovabit/ui/lib/utils";
import type { MarginRule } from "../service/margin-rules.service";

interface RuleRangeRow {
	id: string;
	name: string;
	minPrice: string;
	maxPrice: string | null;
	customerPct: string;
	distributorPct: string;
}

interface ExistingRulesPanelProps {
	title: string;
	description?: string;
	rules: ReadonlyArray<RuleRangeRow>;
	/** Optional id to highlight (e.g. the rule being edited). */
	highlightId?: string;
	className?: string;
}

/**
 * Read-only visual reference of existing margin rules.
 *
 * Rendered inside the create/edit dialog as a Card, so the admin can
 * visualize the price ranges that are already in use and avoid creating
 * overlapping rules (the API still rejects overlaps with 409 — this is
 * only a visual aid).
 */
export function ExistingRulesPanel({
	title,
	description,
	rules,
	highlightId,
	className,
}: ExistingRulesPanelProps) {
	const visible = rules;

	if (visible.length === 0) {
		return null;
	}

	return (
		<Card className={cn("gap-0 overflow-hidden p-3", className)}>
			<div className="mb-2 flex flex-col gap-0.5">
				<h3 className="font-medium text-foreground text-sm">{title}</h3>
				{description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
			</div>
			<div className="divide-border divide-y">
				{visible.map((rule) => (
					<div
						key={rule.id}
						className={cn(
							"flex items-center justify-between gap-2 py-1.5 text-xs",
							highlightId === rule.id && "bg-muted/40 -mx-3 rounded px-3",
						)}
					>
						<div className="flex min-w-0 flex-col">
							<span className="truncate font-medium">{rule.name}</span>
							<span className="text-muted-foreground font-mono tabular-nums">
								S/ {rule.minPrice} → {rule.maxPrice ? `S/ ${rule.maxPrice}` : "∞"}
							</span>
						</div>
						<div className="flex shrink-0 items-center gap-1.5 font-mono tabular-nums">
							<Badge variant="secondary" size="xs">
								C {rule.customerPct}%
							</Badge>
							<Badge variant="outline" size="xs">
								D {rule.distributorPct}%
							</Badge>
						</div>
					</div>
				))}
			</div>
		</Card>
	);
}

export function toRuleRangeRow(rule: MarginRule): RuleRangeRow {
	return {
		id: rule.id,
		name: rule.name,
		minPrice: rule.minPrice,
		maxPrice: rule.maxPrice,
		customerPct: rule.customerPct,
		distributorPct: rule.distributorPct,
	};
}
