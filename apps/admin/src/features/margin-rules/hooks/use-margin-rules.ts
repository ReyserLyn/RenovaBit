import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { marginRulesService } from "../service/margin-rules.service";

// ── Query Key Factory ──────────────────────────────────

export const marginRuleKeys = {
	all: ["margin-rules"] as const,
	lists: () => [...marginRuleKeys.all, "list"] as const,
	list: (filters?: Record<string, unknown>) =>
		[...marginRuleKeys.lists(), ...(filters ? [filters] : [])] as const,
	details: () => [...marginRuleKeys.all, "detail"] as const,
	detail: (id: string) => [...marginRuleKeys.details(), id] as const,
};

// ── Query Options ───────────────────────────────────────

export const marginRulesQueryOptions = queryOptions({
	queryKey: marginRuleKeys.lists(),
	queryFn: () => marginRulesService.list(),
	placeholderData: keepPreviousData,
	staleTime: 1000 * 60 * 5, // 5 min
});

// ── Queries ────────────────────────────────────────────

export function useMarginRules() {
	return useQuery(marginRulesQueryOptions);
}
