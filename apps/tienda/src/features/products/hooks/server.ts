import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { api } from "@/shared/lib/api/api-client";
import type { ProductListFilters } from "./queries";

export const getProductBySlugServerFn = createServerFn({ method: "GET" })
	.validator((input: { slug: string }) => input)
	.handler(async ({ data: { slug } }) => {
		try {
			const reqHeaders = getRequestHeaders();
			const cookie = reqHeaders.get("cookie") ?? "";

			const { data, error } = await api.api.v1.products({ slug }).get({
				headers: { cookie },
			});

			if (error || !data) return null;
			return data;
		} catch {
			return null;
		}
	});

export const getProductListServerFn = createServerFn({ method: "GET" })
	.validator((input: ProductListFilters & { limit?: number; offset?: number }) => input)
	.handler(async ({ data: filters }) => {
		try {
			const reqHeaders = getRequestHeaders();
			const cookie = reqHeaders.get("cookie") ?? "";

			const { data, error } = await api.api.v1.products.get({
				headers: { cookie },
				query: {
					brands: filters.brands,
					categoryId: filters.categoryId,
					categorySlug: filters.categorySlug,
					isFeatured: filters.isFeatured,
					search: filters.search,
					sortBy: filters.sortBy,
					minPrice: filters.minPrice,
					maxPrice: filters.maxPrice,
					excludeSlug: filters.excludeSlug,
					limit: filters.limit,
					offset: filters.offset,
				},
			});

			if (error || !data) return null;
			return data;
		} catch {
			return null;
		}
	});
