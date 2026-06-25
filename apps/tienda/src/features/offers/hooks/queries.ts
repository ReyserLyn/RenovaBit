import { queryOptions } from "@tanstack/react-query";
import { api, getApiSsrHeaders, unwrapResponse } from "@/shared/lib/api";

// ── Query Keys Factory ─────────────────────────────

export const offerKeys = {
	all: ["offers"] as const,
	featured: () => [...offerKeys.all, "featured"] as const,
};

// ── Query Options ──────────────────────────────────

/**
 * Ofertas activas marcadas como destacadas (isFeatured=true).
 * Cap: 10 offers, 20 productos por offer (límite práctico para home).
 */
export const offerQueries = {
	featured: () =>
		queryOptions({
			queryKey: offerKeys.featured(),
			queryFn: async () => {
				const headers = await getApiSsrHeaders();
				return unwrapResponse(
					api.api.v1.offers.get({
						query: { isFeatured: "true", limit: 10, productsLimit: 20 },
						headers,
					}),
				);
			},
			staleTime: 1000 * 60 * 5, // 5 min
		}),
};
