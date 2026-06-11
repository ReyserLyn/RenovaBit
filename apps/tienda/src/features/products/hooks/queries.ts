import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { api, unwrapResponse } from "@/shared/lib/api";

// ── Query Keys Factory ───────────────────────────────────────

export const productKeys = {
	all: ["products"] as const,
	lists: () => [...productKeys.all, "list"] as const,
	list: (filters: ProductListFilters = {}) => [...productKeys.lists(), filters] as const,
	infinite: (filters: ProductListFilters = {}) =>
		[...productKeys.lists(), "infinite", filters] as const,
	details: () => [...productKeys.all, "detail"] as const,
	detail: (slug: string) => [...productKeys.details(), slug] as const,
};

// ── Filters ──────────────────────────────────────────────────

export interface ProductListFilters {
	categoryId?: string;
	categorySlug?: string;
	brands?: string;
	isFeatured?: boolean;
	search?: string;
	sortBy?: string;
	minPrice?: string;
	maxPrice?: string;
	excludeSlug?: string;
	limit?: number;
}

// ── Constants ────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20;

// ── Query Options ─────────────────────────────────────────────

export const productQueries = {
	list: (filters: ProductListFilters = {}, limit = 100) =>
		queryOptions({
			queryKey: productKeys.list({ ...filters, limit }),
			queryFn: async () => {
				const result = await unwrapResponse(
					api.api.v1.products.get({
						query: {
							brands: filters.brands,
							categoryId: filters.categoryId,
							categorySlug: filters.categorySlug,
							isFeatured: filters.isFeatured,
							search: filters.search,
							sortBy: filters.sortBy,
							minPrice: filters.minPrice,
							maxPrice: filters.maxPrice,
							excludeSlug: filters.excludeSlug,
							limit,
						},
					}),
				);
				return result.data;
			},
			staleTime: 1000 * 60 * 5,
		}),

	infiniteList: (filters: ProductListFilters = {}, limit = DEFAULT_PAGE_SIZE) =>
		infiniteQueryOptions({
			queryKey: productKeys.infinite({ ...filters, limit }),
			queryFn: ({ pageParam }) =>
				unwrapResponse(
					api.api.v1.products.get({
						query: {
							brands: filters.brands,
							categoryId: filters.categoryId,
							categorySlug: filters.categorySlug,
							isFeatured: filters.isFeatured,
							search: filters.search,
							sortBy: filters.sortBy,
							minPrice: filters.minPrice,
							maxPrice: filters.maxPrice,
							excludeSlug: filters.excludeSlug,
							offset: pageParam as number,
							limit,
						},
					}),
				),
			initialPageParam: 0,
			getNextPageParam: (lastPage) => {
				const nextOffset = lastPage.offset + lastPage.limit;
				return nextOffset < lastPage.total ? nextOffset : undefined;
			},
			placeholderData: (previousData) => previousData,
			staleTime: 1000 * 60 * 5,
		}),

	bySlug: (slug: string) =>
		queryOptions({
			queryKey: productKeys.detail(slug),
			queryFn: () => unwrapResponse(api.api.v1.products({ slug }).get()),
			staleTime: 1000 * 60 * 5,
		}),
};
