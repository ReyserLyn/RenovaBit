import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { api } from "@/shared/lib/api/api-client";
import type { SearchFilters } from "./queries";

export const getSearchResultsServerFn = createServerFn({ method: "GET" })
	.validator((input: SearchFilters & { limit?: number; offset?: number }) => input)
	.handler(async ({ data: { q, brands, minPrice, maxPrice, sortBy, limit, offset } }) => {
		try {
			const reqHeaders = getRequestHeaders();
			const cookie = reqHeaders.get("cookie") ?? "";

			const { data, error } = await api.api.v1.products.search.get({
				headers: { cookie },
				query: {
					q,
					brands,
					minPrice,
					maxPrice,
					sortBy,
					limit,
					offset,
				},
			});

			if (error || !data) return null;
			return data;
		} catch {
			return null;
		}
	});
