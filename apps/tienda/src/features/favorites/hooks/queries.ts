import { infiniteQueryOptions, keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api, getApiSsrHeaders, unwrapResponse } from "@/shared/lib/api";
import { useCartSsr } from "@/shared/lib/stores/cart-ssr-context";
import { getFavoritesServerFn } from "./server";

// ── Types inferred from API ──────────────────────────────────

type _FavoritesListResponse =
	Awaited<ReturnType<typeof api.api.v1.favorites.get>> extends { data: infer T } ? T : never;
export type FavoriteListResponse = NonNullable<_FavoritesListResponse>;

type _FavoriteStatusBatchResponse =
	Awaited<ReturnType<typeof api.api.v1.favorites.status.get>> extends { data: infer T } ? T : never;
export type FavoriteStatusBatchResponse = NonNullable<_FavoriteStatusBatchResponse>;

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
	/**
	 * Key for the batched status map. The sorted productIds list is the
	 * identity of the query — any re-order of the same ids hits the same
	 * cache entry, so a re-render that re-shuffles the array doesn't
	 * invalidate the result.
	 */
	statuses: (productIds: ReadonlyArray<string>) =>
		[...favoritesKeys.all, "statuses", [...productIds].sort()] as const,
};

/**
 * Hook for product listings. Runs one batched query for the full visible
 * productIds array and returns a `productId → isFavorite` map. Undefined
 * entries mean "not favorite" (anonymous session or not yet loaded).
 */
export function useFavoriteStatusMap(
	productIds: ReadonlyArray<string>,
): Readonly<Record<string, boolean>> {
	const { session } = useCartSsr();
	const { data } = useQuery({
		queryKey: favoritesKeys.statuses(productIds),
		queryFn: async () => {
			const headers = await getApiSsrHeaders();
			return unwrapResponse(
				api.api.v1.favorites.status.get({
					headers,
					query: { productIds: [...productIds] },
				}),
			);
		},
		// Skip the network call entirely for anonymous sessions. The
		// /status endpoint requires auth and would 401 otherwise.
		enabled: !!session?.user && productIds.length > 0,
		staleTime: 1000 * 60 * 5,
	});
	return useMemo(() => {
		const map: Record<string, boolean> = {};
		for (const id of productIds) map[id] = false;
		if (data?.statuses) Object.assign(map, data.statuses);
		return map;
	}, [productIds, data]);
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
