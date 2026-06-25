import { queryOptions } from "@tanstack/react-query";
import { api, getApiSsrHeaders, unwrapResponse } from "@/shared/lib/api";

// ── Query Keys Factory ───────────────────────────────────────

export const brandKeys = {
	all: ["brands"] as const,
	lists: () => [...brandKeys.all, "list"] as const,
	list: () => [...brandKeys.lists()] as const,
	listByCategory: (categorySlug: string) =>
		[...brandKeys.lists(), "category", categorySlug] as const,
	featured: () => [...brandKeys.all, "featured"] as const,
	details: () => [...brandKeys.all, "detail"] as const,
	detail: (slug: string) => [...brandKeys.details(), slug] as const,
};

// ── Types inferred from API ────────────────────────────────

type _FeaturedBrandsResponse =
	Awaited<ReturnType<typeof api.api.v1.brands.featured.get>> extends {
		data: infer T;
	}
		? T
		: never;
export type FeaturedBrand = NonNullable<_FeaturedBrandsResponse>[number];

// ── Query Options ─────────────────────────────────────────────

export const brandQueries = {
	/** Lista de marcas activas */
	list: () =>
		queryOptions({
			queryKey: brandKeys.list(),
			queryFn: async () => {
				const headers = await getApiSsrHeaders();
				return unwrapResponse(api.api.v1.brands.get({ headers }));
			},
			staleTime: 1000 * 60 * 10,
		}),

	byCategorySlug: (categorySlug: string) =>
		queryOptions({
			queryKey: brandKeys.listByCategory(categorySlug),
			queryFn: async () => {
				const headers = await getApiSsrHeaders();
				return unwrapResponse(api.api.v1.brands.get({ headers, query: { categorySlug } }));
			},
			staleTime: 1000 * 60 * 10,
		}),

	bySearchTerm: ({ q, categorySlug }: { q: string; categorySlug?: string }) =>
		queryOptions({
			queryKey: [...brandKeys.lists(), "search", q, categorySlug ?? ""] as const,
			queryFn: async () => {
				const headers = await getApiSsrHeaders();
				return unwrapResponse(
					api.api.v1.brands.get({
						headers,
						query: { q, ...(categorySlug ? { categorySlug } : {}) },
					}),
				);
			},
			staleTime: 1000 * 60 * 5,
		}),

	/**
	 * Marcas featured para el home carousel. Lista plana, ordenadas por
	 * productCount DESC (server-side, cap 20).
	 */
	featured: () =>
		queryOptions({
			queryKey: brandKeys.featured(),
			queryFn: async () => {
				const headers = await getApiSsrHeaders();
				return unwrapResponse(api.api.v1.brands.featured.get({ headers }));
			},
			staleTime: 1000 * 60 * 10,
		}),

	bySlug: (slug: string) =>
		queryOptions({
			queryKey: brandKeys.detail(slug),
			queryFn: async () => {
				const headers = await getApiSsrHeaders();
				return unwrapResponse(api.api.v1.brands({ slug }).get({ headers }));
			},
			staleTime: 1000 * 60 * 5,
		}),
};
