import { queryOptions } from "@tanstack/react-query";
import { api, getApiSsrHeaders, unwrapResponse } from "@/shared/lib/api";

// ── Query Keys Factory ───────────────────────────────────────

export const categoryKeys = {
	all: ["categories"] as const,
	tree: () => [...categoryKeys.all, "tree"] as const,
	details: () => [...categoryKeys.all, "detail"] as const,
	detail: (slug: string) => [...categoryKeys.details(), slug] as const,
};

// ── Query Options ─────────────────────────────────────────────
export const categoryQueries = {
	/** Árbol jerárquico de categorías con conteo de productos */
	tree: () =>
		queryOptions({
			queryKey: categoryKeys.tree(),
			queryFn: async () => {
				const headers = await getApiSsrHeaders();
				return unwrapResponse(api.api.v1.categories.get({ headers }));
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
