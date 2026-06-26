import { queryOptions } from "@tanstack/react-query";
import { api, getApiSsrHeaders, unwrapResponse } from "@/shared/lib/api";

// ── Query Keys Factory ───────────────────────────────────────

export interface CategoryTreeFilters {
	/** Comma-separated brand slugs (multi). Usado por /productos. */
	brands?: string;
}

export const categoryKeys = {
	all: ["categories"] as const,
	tree: (filters: CategoryTreeFilters = {}) => [...categoryKeys.all, "tree", filters] as const,
	featured: () => [...categoryKeys.all, "featured"] as const,
	details: () => [...categoryKeys.all, "detail"] as const,
	detail: (slug: string) => [...categoryKeys.details(), slug] as const,
};

// ── Types inferred from API ────────────────────────────────

type _FeaturedCategoriesResponse =
	Awaited<ReturnType<typeof api.api.v1.categories.featured.get>> extends {
		data: infer T;
	}
		? T
		: never;
export type FeaturedCategory = NonNullable<_FeaturedCategoriesResponse>[number];

// ── Query Options ─────────────────────────────────────────────
export const categoryQueries = {
	/**
	 * Árbol jerárquico de categorías con conteo de productos. Opcionalmente
	 * filtrado por marcas (multi) — los productCount de cada nodo reflejan
	 * las marcas seleccionadas. Usado por /productos para filtrado bidireccional.
	 */
	tree: (filters: CategoryTreeFilters = {}) =>
		queryOptions({
			queryKey: categoryKeys.tree(filters),
			queryFn: async () => {
				const headers = await getApiSsrHeaders();
				return unwrapResponse(
					api.api.v1.categories.get({
						headers,
						query: filters.brands ? { brands: filters.brands } : {},
					}),
				);
			},
			staleTime: 1000 * 60 * 10, // 10 min
		}),

	/**
	 * Categorías featured para el home carousel. Lista plana,
	 * ordenadas por productCount DESC (server-side).
	 */
	featured: () =>
		queryOptions({
			queryKey: categoryKeys.featured(),
			queryFn: async () => {
				const headers = await getApiSsrHeaders();
				return unwrapResponse(api.api.v1.categories.featured.get({ headers }));
			},
			staleTime: 1000 * 60 * 10, // 10 min
		}),

	/** Categoría por slug (incluye breadcrumb y productCount) */
	bySlug: (slug: string) =>
		queryOptions({
			queryKey: categoryKeys.detail(slug),
			queryFn: async () => {
				const headers = await getApiSsrHeaders();
				return unwrapResponse(api.api.v1.categories({ slug }).get({ headers }));
			},
			staleTime: 1000 * 60 * 5, // 5 min
		}),
};
