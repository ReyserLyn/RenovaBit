import { infiniteQueryOptions, keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api, unwrapResponse } from "@/shared/lib/api";

// ── Query Keys Factory ───────────────────────────────────────

export const searchKeys = {
	all: ["search"] as const,
	autocomplete: (q: string) => [...searchKeys.all, "autocomplete", q] as const,
	infinite: (q: string, filters?: Omit<SearchFilters, "q">) =>
		[...searchKeys.all, "infinite", q, filters ?? {}] as const,
};

// ── Filters ──────────────────────────────────────────────────

export interface SearchFilters {
	q: string;
	brands?: string;
	minPrice?: string;
	maxPrice?: string;
	sortBy?: string;
}

// ── Constants ────────────────────────────────────────────────

const AUTOCOMPLETE_LIMIT = 5;
const DEFAULT_PAGE_SIZE = 20;

// ── Query Options ─────────────────────────────────────────────

export const searchQueries = {
	autocomplete: (q: string) =>
		queryOptions({
			queryKey: searchKeys.autocomplete(q),
			queryFn: async () => {
				const result = await unwrapResponse(
					api.api.v1.products.search.get({
						query: { q, limit: AUTOCOMPLETE_LIMIT, offset: 0 },
					}),
				);
				return result.data;
			},
			enabled: q.length >= 2,
			staleTime: 0,
			gcTime: 1000 * 60 * 2,
		}),

	infiniteResults: ({
		q,
		brands,
		minPrice,
		maxPrice,
		sortBy,
		limit = DEFAULT_PAGE_SIZE,
	}: SearchFilters & { limit?: number }) =>
		infiniteQueryOptions({
			queryKey: searchKeys.infinite(q, { brands, minPrice, maxPrice, sortBy }),
			queryFn: async ({ pageParam }) => {
				const result = await unwrapResponse(
					api.api.v1.products.search.get({
						query: { q, brands, minPrice, maxPrice, sortBy, limit, offset: pageParam },
					}),
				);
				return result;
			},
			initialPageParam: 0,
			getNextPageParam: (lastPage) => {
				return lastPage.hasMore ? lastPage.offset + lastPage.limit : undefined;
			},
			placeholderData: keepPreviousData,
			staleTime: 1000 * 60 * 5,
		}),
};
