import { queryOptions } from "@tanstack/react-query";
import { api, unwrapResponse } from "@/shared/lib/api";
import type {
	BreadcrumbItem,
	Category,
	CategoryBreadcrumbParams,
	CategoryListParams,
	CategoryTreeNode,
	CategoryTreeParams,
} from "../types";

// ── Query Keys Factory ───────────────────────────────────────

export const categoryKeys = {
	all: ["categories"] as const,
	lists: () => [...categoryKeys.all, "list"] as const,
	list: (filters?: CategoryListParams) => [...categoryKeys.lists(), filters] as const,
	tree: (params?: CategoryTreeParams) => [...categoryKeys.all, "tree", params] as const,
	details: () => [...categoryKeys.all, "detail"] as const,
	detail: (slug: string) => [...categoryKeys.details(), slug] as const,
	breadcrumb: (slug: string, params?: CategoryBreadcrumbParams) =>
		[...categoryKeys.all, "breadcrumb", slug, params] as const,
};

// ── Query Options ─────────────────────────────────────────────
export const categoryQueries = {
	/** Lista plana de categorías con filtros */
	list: (filters?: CategoryListParams) =>
		queryOptions({
			queryKey: categoryKeys.list(filters),
			queryFn: () =>
				unwrapResponse(
					api.api.v1.categories.get({
						query: filters as Record<string, string | boolean | undefined>,
					}),
				),
			staleTime: 1000 * 60 * 10, // 10 min
		}),

	/** Árbol jerárquico de categorías (ideal para navbar) */
	tree: (params?: CategoryTreeParams) =>
		queryOptions({
			queryKey: categoryKeys.tree(params),
			queryFn: () =>
				unwrapResponse(
					api.api.v1.categories.tree.get({
						query: params as Record<string, string | boolean | undefined>,
					}),
				),
			staleTime: 1000 * 60 * 10, // 10 min
		}),

	/** Categoría por slug */
	bySlug: (slug: string, params?: CategoryBreadcrumbParams) =>
		queryOptions({
			queryKey: categoryKeys.detail(slug),
			queryFn: () =>
				unwrapResponse(
					api.api.v1.categories.slug({ slug }).get({
						query: params as Record<string, string | boolean | undefined>,
					}),
				),
			staleTime: 1000 * 60 * 5, // 5 min
		}),

	/** Breadcrumb de categoría */
	breadcrumb: (slug: string, params?: CategoryBreadcrumbParams) =>
		queryOptions({
			queryKey: categoryKeys.breadcrumb(slug, params),
			queryFn: () =>
				unwrapResponse(
					api.api.v1.categories.breadcrumb({ slug }).get({
						query: params as Record<string, string | boolean | undefined>,
					}),
				),
			staleTime: 1000 * 60 * 5, // 5 min
		}),
};
