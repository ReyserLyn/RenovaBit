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
	brandId?: string;
	brandSlug?: string;
	isFeatured?: boolean;
	search?: string;
	excludeSlug?: string;
	limit?: number;
}

// ── Constants ────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20;

// ── Query Options ─────────────────────────────────────────────

export const productQueries = {
	/** Productos filtrados (categoría, marca, destacados, búsqueda).
	 *  Devuelve solo el array data (sin meta de paginación). */
	list: (filters: ProductListFilters = {}, limit = 100) =>
		queryOptions({
			queryKey: productKeys.list({ ...filters, limit }),
			queryFn: async () => {
				const result = await unwrapResponse(
					api.api.v1.products.get({
						query: {
							brandId: filters.brandId,
							brandSlug: filters.brandSlug,
							categoryId: filters.categoryId,
							categorySlug: filters.categorySlug,
							isFeatured: filters.isFeatured,
							search: filters.search,
							excludeSlug: filters.excludeSlug,
							limit,
						},
					}),
				);
				return result.data;
			},
			staleTime: 1000 * 60 * 5, // 5 min
		}),

	/** Infinite query para scroll infinito (offset-based).
	 *  Cada página devuelve el objeto paginado completo. */
	infiniteList: (filters: ProductListFilters = {}, limit = DEFAULT_PAGE_SIZE) =>
		infiniteQueryOptions({
			queryKey: productKeys.infinite({ ...filters, limit }),
			queryFn: ({ pageParam }) =>
				unwrapResponse(
					api.api.v1.products.get({
						query: {
							brandId: filters.brandId,
							brandSlug: filters.brandSlug,
							categoryId: filters.categoryId,
							categorySlug: filters.categorySlug,
							isFeatured: filters.isFeatured,
							search: filters.search,
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
			staleTime: 1000 * 60 * 5,
		}),

	/** Infinite query para categoría */
	infiniteByCategorySlug: (slug: string, limit = DEFAULT_PAGE_SIZE) =>
		productQueries.infiniteList({ categorySlug: slug }, limit),

	/** Infinite query para marca */
	infiniteByBrandSlug: (slug: string, limit = DEFAULT_PAGE_SIZE) =>
		productQueries.infiniteList({ brandSlug: slug }, limit),

	/** Detalle de producto por slug */
	bySlug: (slug: string) =>
		queryOptions({
			queryKey: productKeys.detail(slug),
			queryFn: () => unwrapResponse(api.api.v1.products({ slug }).get()),
			staleTime: 1000 * 60 * 5, // 5 min
		}),
};
