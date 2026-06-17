import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { api } from "@/shared/lib/api/api-client";
import type { FavoriteListResponse, FavoritesFilters } from "./queries";

export interface GetFavoritesInput {
	offset: number;
	limit: number;
	filters?: FavoritesFilters;
}

export const getFavoritesServerFn = createServerFn({ method: "GET" })
	.validator((input: GetFavoritesInput) => input)
	.handler(async ({ data: { offset, limit, filters } }): Promise<FavoriteListResponse | null> => {
		const reqHeaders = getRequestHeaders();
		const cookie = reqHeaders.get("cookie") ?? "";

		const { data, error } = await api.api.v1.favorites.get({
			headers: { cookie },
			query: {
				offset,
				limit,
				sortBy: filters?.sortBy,
				brands: filters?.brands,
				minPrice: filters?.minPrice,
				maxPrice: filters?.maxPrice,
			},
		});

		if (error || !data) return null;
		return data;
	});
