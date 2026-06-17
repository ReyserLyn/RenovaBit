import { infiniteQueryOptions, keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, unwrapResponse } from "@/shared/lib/api";

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

// ── Type Guard ───────────────────────────────────────────────

function isFavoriteListResponse(data: unknown): data is FavoriteListResponse {
	return (
		typeof data === "object" &&
		data !== null &&
		"data" in data &&
		"total" in data &&
		"offset" in data &&
		"limit" in data &&
		"hasMore" in data &&
		"brands" in data
	);
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
		queryFn: () => unwrapResponse(api.api.v1.favorites.items({ productId }).status.get()),
		staleTime: 1000 * 60 * 5,
	});
}

// ── Query Options ─────────────────────────────────────────────

export const favoritesQueries = {
	infinite: (filters?: FavoritesFilters, limit: number = DEFAULT_PAGE_SIZE) =>
		infiniteQueryOptions({
			queryKey: favoritesKeys.infinite(filters),
			queryFn: async ({ pageParam }) => {
				// SSR: use raw fetch with cookie forwarding
				// Server (Nitro) doesn't have `document`, so Eden Treaty can't authenticate.
				if (typeof document === "undefined") {
					const { getApiBaseUrl } = await import("@/shared/lib/env");
					const { getRequestHeaders } = await import("@tanstack/react-start/server");
					const apiUrl = getApiBaseUrl();
					const headers = getRequestHeaders();

					const params = new URLSearchParams();
					params.set("offset", String(pageParam));
					params.set("limit", String(limit));
					if (filters?.sortBy) params.set("sortBy", filters.sortBy);
					if (filters?.brands) params.set("brands", filters.brands);
					if (filters?.minPrice) params.set("minPrice", filters.minPrice);
					if (filters?.maxPrice) params.set("maxPrice", filters.maxPrice);

					const response = await fetch(`${apiUrl}/api/v1/favorites?${params}`, {
						headers: { cookie: headers.get?.("cookie") ?? "" },
					});
					if (!response.ok) {
						throw new Error(`SSR fetch failed: ${response.status}`);
					}
					const json: unknown = await response.json();
					if (!isFavoriteListResponse(json)) {
						throw new Error("Invalid SSR response shape");
					}
					return json;
				}

				// Client: use Eden Treaty with browser cookies
				const result = await unwrapResponse(
					api.api.v1.favorites.get({
						query: {
							offset: pageParam,
							limit,
							sortBy: filters?.sortBy,
							brands: filters?.brands,
							minPrice: filters?.minPrice,
							maxPrice: filters?.maxPrice,
						},
					}),
				);
				return result;
			},
			initialPageParam: 0,
			getNextPageParam: (lastPage) => {
				return lastPage.hasMore ? lastPage.offset + lastPage.limit : undefined;
			},
			placeholderData: keepPreviousData,
			staleTime: 1000 * 60 * 5,
		}),
};
