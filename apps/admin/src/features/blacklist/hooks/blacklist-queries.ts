import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { blacklistService } from "../service/blacklist.service";

// ── Query Key Factory ──────────────────────────────────

export const blacklistKeys = {
	all: ["blacklist"] as const,
	lists: () => [...blacklistKeys.all, "list"] as const,
	list: (filters?: Record<string, unknown>) =>
		[...blacklistKeys.lists(), ...(filters ? [filters] : [])] as const,
};

// ── Query Options ──────────────────────────────────────

export const blacklistQueryOptions = queryOptions({
	queryKey: blacklistKeys.lists(),
	queryFn: () => blacklistService.list(),
	placeholderData: keepPreviousData,
	staleTime: 1000 * 60 * 5, // 5 min
});

// ── Queries ────────────────────────────────────────────

export function useBlacklist() {
	return useQuery(blacklistQueryOptions);
}
