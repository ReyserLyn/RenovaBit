import { queryOptions, useQuery } from "@tanstack/react-query";
import type { Category, CategoryTreeNode } from "../model";
import { categoriesService } from "../service/categories.service";

// ── Tree builder ───────────────────────────────────────

export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
	const byParent = new Map<string | null, Category[]>();
	for (const cat of categories) {
		const key = cat.parentId ?? null;
		const group = byParent.get(key) ?? [];
		group.push(cat);
		byParent.set(key, group);
	}

	for (const [, group] of byParent) {
		group.sort((a, b) => {
			const aOrder = a.sortOrder ?? 0;
			const bOrder = b.sortOrder ?? 0;
			if (aOrder !== bOrder) return aOrder - bOrder;
			return a.name.localeCompare(b.name);
		});
	}

	const mapNode = (cat: Category): CategoryTreeNode => ({
		id: cat.id,
		name: cat.name,
		slug: cat.slug,
		imageUrl: cat.imageUrl,
		description: cat.description,
		sortOrder: cat.sortOrder,
		isFeatured: cat.isFeatured,
		isActive: cat.isActive,
		isVisibleInNav: cat.isVisibleInNav,
		children: (byParent.get(cat.id) ?? []).map(mapNode),
	});

	return (byParent.get(null) ?? []).map(mapNode);
}

// ── Query Key Factory ──────────────────────────────────

export const categoryKeys = {
	all: ["categories"] as const,
	lists: () => [...categoryKeys.all, "list"] as const,
	list: (filters?: Record<string, unknown>) =>
		[...categoryKeys.lists(), ...(filters ? [filters] : [])] as const,
	trees: () => [...categoryKeys.all, "tree"] as const,
	tree: (filters?: Record<string, unknown>) =>
		[...categoryKeys.trees(), ...(filters ? [filters] : [])] as const,
	details: () => [...categoryKeys.all, "detail"] as const,
	detail: (id: string) => [...categoryKeys.details(), id] as const,
	breadcrumbs: () => [...categoryKeys.all, "breadcrumb"] as const,
	breadcrumb: (slug: string) => [...categoryKeys.breadcrumbs(), slug] as const,
};

// ── Query Options ───────────────────────────────────────

export const categoriesQueryOptions = queryOptions({
	queryKey: categoryKeys.lists(),
	queryFn: () => categoriesService.list(),
	staleTime: 1000 * 60 * 5, // 5 min
});

// ── Queries ────────────────────────────────────────────

export function useCategories() {
	return useQuery(categoriesQueryOptions);
}

export function useCategory(id: string) {
	return useQuery({
		queryKey: categoryKeys.detail(id),
		queryFn: () => categoriesService.getById(id),
		enabled: id.length > 0,
	});
}

export function useCategoryBreadcrumb(slug: string) {
	return useQuery({
		queryKey: categoryKeys.breadcrumb(slug),
		queryFn: () => categoriesService.getBreadcrumb(slug),
		enabled: slug.length > 0,
	});
}
