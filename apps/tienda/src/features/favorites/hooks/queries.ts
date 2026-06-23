import { infiniteQueryOptions, keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, getApiSsrHeaders, unwrapResponse } from "@/shared/lib/api";
import { getFavoritesServerFn } from "./server";

// ── Types inferred from API ──────────────────────────────────

type _FavoritesListResponse =
	Awaited<ReturnType<typeof api.api.v1.favorites.get>> extends { data: infer T } ? T : never;
export type FavoriteListResponse = NonNullable<_FavoritesListResponse>;

// ── Filters ──────────────────────────────────────────────────

export interface FavoritesFilters {
	sortBy?: string;
	brands?: string;
	minPrice?: string;
	maxPrice?: string;
}

// ── Optimistic Snapshot ──────────────────────────────────────

export interface FavoriteSnapshot {
	productId: string;
	productName: string;
	productSlug: string;
	productSku: string;
	price: string;
	stock: number;
	isInStock: boolean;
	primaryImage: { url: string; alt: string | null } | null;
	brand: { id: string; name: string; slug: string } | null;
	category: { id: string; name: string; slug: string } | null;
}

// ── Constants ────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20;

// ── Query Keys Factory ───────────────────────────────────────

export const favoritesKeys = {
	all: ["favorites"] as const,
	infinite: (filters?: FavoritesFilters) =>
		[...favoritesKeys.all, "infinite", filters ?? {}] as const,
	detail: (productId: string) => [...favoritesKeys.all, "detail", productId] as const,
};

// ── Favorite Status ────────────────────────────────────────────

export function useFavoriteStatus(productId: string) {
	return useQuery({
		queryKey: favoritesKeys.detail(productId),
		queryFn: async () => {
			const headers = await getApiSsrHeaders();
			return unwrapResponse(api.api.v1.favorites.items({ productId }).status.get({ headers }));
		},
		staleTime: 1000 * 60 * 5,
	});
}

// ── Query Options ─────────────────────────────────────────────

export const favoritesQueries = {
	infinite: (filters?: FavoritesFilters, limit: number = DEFAULT_PAGE_SIZE) =>
		infiniteQueryOptions({
			queryKey: favoritesKeys.infinite(filters),
			queryFn: ({ pageParam }) =>
				getFavoritesServerFn({ data: { offset: pageParam, limit, filters } }),
			initialPageParam: 0,
			getNextPageParam: (lastPage) => {
				if (!lastPage) return undefined;
				return lastPage.hasMore ? lastPage.offset + lastPage.limit : undefined;
			},
			placeholderData: keepPreviousData,
			staleTime: 1000 * 60 * 5,
		}),
};
