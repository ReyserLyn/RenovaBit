import { queryOptions, useQuery } from "@tanstack/react-query";
import { brandsService } from "../service/brands.service";

// ── Query Key Factory ──────────────────────────────────

export const brandKeys = {
	all: ["brands"] as const,
	lists: () => [...brandKeys.all, "list"] as const,
	list: (filters?: Record<string, unknown>) =>
		[...brandKeys.lists(), ...(filters ? [filters] : [])] as const,
	details: () => [...brandKeys.all, "detail"] as const,
	detail: (id: string) => [...brandKeys.details(), id] as const,
};

// ── Query Options ──────────────────────────────────────

export const brandsQueryOptions = queryOptions({
	queryKey: brandKeys.lists(),
	queryFn: () => brandsService.list(),
	staleTime: 1000 * 60 * 5, // 5 min
});

// ── Queries ────────────────────────────────────────────

export function useBrands() {
	return useQuery(brandsQueryOptions);
}

export function useBrand(id: string) {
	return useQuery({
		queryKey: brandKeys.detail(id),
		queryFn: () => brandsService.getById(id),
		enabled: id.length > 0,
	});
}
