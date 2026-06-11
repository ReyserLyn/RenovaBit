import { queryOptions } from "@tanstack/react-query";
import { api, unwrapResponse } from "@/shared/lib/api";

// ── Query Keys Factory ───────────────────────────────────────

export const brandKeys = {
	all: ["brands"] as const,
	lists: () => [...brandKeys.all, "list"] as const,
	list: () => [...brandKeys.lists()] as const,
	listByCategory: (categorySlug: string) =>
		[...brandKeys.lists(), "category", categorySlug] as const,
	details: () => [...brandKeys.all, "detail"] as const,
	detail: (slug: string) => [...brandKeys.details(), slug] as const,
};

// ── Query Options ─────────────────────────────────────────────

export const brandQueries = {
	/** Lista de marcas activas */
	list: () =>
		queryOptions({
			queryKey: brandKeys.list(),
			queryFn: () => unwrapResponse(api.api.v1.brands.get()),
			staleTime: 1000 * 60 * 10,
		}),

	byCategorySlug: (categorySlug: string) =>
		queryOptions({
			queryKey: brandKeys.listByCategory(categorySlug),
			queryFn: () => unwrapResponse(api.api.v1.brands.get({ query: { categorySlug } })),
			staleTime: 1000 * 60 * 10,
		}),

	bySlug: (slug: string) =>
		queryOptions({
			queryKey: brandKeys.detail(slug),
			queryFn: () => unwrapResponse(api.api.v1.brands({ slug }).get()),
			staleTime: 1000 * 60 * 5,
		}),
};
