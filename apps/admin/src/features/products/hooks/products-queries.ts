import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { productsService } from "../service/products.service";

// ── Query Key Factory ──────────────────────────────────

export const productKeys = {
	all: ["products"] as const,
	lists: () => [...productKeys.all, "list"] as const,
	list: (filters?: Record<string, unknown>) =>
		[...productKeys.lists(), ...(filters ? [filters] : [])] as const,
	details: () => [...productKeys.all, "detail"] as const,
	detail: (id: string) => [...productKeys.details(), id] as const,
};

// ── Query Options ──────────────────────────────────────

export const productsQueryOptions = queryOptions({
	queryKey: productKeys.lists(),
	queryFn: () => productsService.list(),
	placeholderData: keepPreviousData,
	staleTime: 1000 * 60 * 5, // 5 min
});

// ── Queries ────────────────────────────────────────────

export function useProducts() {
	return useQuery(productsQueryOptions);
}

export function useProduct(id: string) {
	return useQuery({
		queryKey: productKeys.detail(id),
		queryFn: () => productsService.getById(id),
		enabled: id.length > 0,
	});
}
