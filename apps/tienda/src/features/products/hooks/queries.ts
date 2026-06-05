import { queryOptions } from "@tanstack/react-query";
import { api, unwrapResponse } from "@/shared/lib/api";
import type { ProductDetail, ProductListItem } from "../types";

// ── Query Keys Factory ───────────────────────────────────────

export const productKeys = {
	all: ["products"] as const,
	lists: () => [...productKeys.all, "list"] as const,
	list: (filters: ProductListFilters = {}) => [...productKeys.lists(), filters] as const,
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
}

// ── Query Options ─────────────────────────────────────────────

export const productQueries = {
	/** Productos filtrados (categoría, marca, destacados, búsqueda) */
	list: (filters: ProductListFilters = {}) =>
		queryOptions({
			queryKey: productKeys.list(filters),
			queryFn: () =>
				unwrapResponse<ProductListItem[]>(
					api.api.v1.products.get({
						query: {
							brandId: filters.brandId,
							brandSlug: filters.brandSlug,
							categoryId: filters.categoryId,
							categorySlug: filters.categorySlug,
							isFeatured: filters.isFeatured,
							search: filters.search,
						},
					}),
				),
			staleTime: 1000 * 60 * 5, // 5 min
		}),

	/** Productos de una categoría por slug (incluye agregación de hijos) */
	byCategorySlug: (slug: string) => productQueries.list({ categorySlug: slug }),

	/** Productos de una marca por slug */
	byBrandSlug: (slug: string) => productQueries.list({ brandSlug: slug }),

	/** Detalle de producto por slug */
	bySlug: (slug: string) =>
		queryOptions({
			queryKey: productKeys.detail(slug),
			queryFn: () => unwrapResponse<ProductDetail>(api.api.v1.products({ slug }).get()),
			staleTime: 1000 * 60 * 5, // 5 min
		}),
};
