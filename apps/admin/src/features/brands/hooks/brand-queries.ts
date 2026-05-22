import { useQuery } from "@tanstack/react-query";
import { brandsService } from "../service/brands.service";

// ── Query Key Factory ──────────────────────────────────

export const brandKeys = {
	all: ["brands"] as const,
	lists: () => [...brandKeys.all, "list"] as const,
	list: (filters?: Record<string, unknown>) =>
		[...brandKeys.lists(), ...(filters ? [filters] : [])] as const,
	details: () => [...brandKeys.all, "detail"] as const,
	detail: (slug: string) => [...brandKeys.details(), slug] as const,
};

// ── Queries ────────────────────────────────────────────

export function useBrands() {
	return useQuery({
		queryKey: brandKeys.lists(),
		queryFn: () => brandsService.list(),
	});
}

export function useBrand(slug: string) {
	return useQuery({
		queryKey: brandKeys.detail(slug),
		queryFn: () => brandsService.getBySlug(slug),
		enabled: slug.length > 0,
	});
}
