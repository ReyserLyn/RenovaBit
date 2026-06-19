import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { offersService } from "../service/offers.service";

// ── Query Key Factory ──────────────────────────────────

export const offerKeys = {
	all: ["offers"] as const,
	lists: () => [...offerKeys.all, "list"] as const,
	list: (filters?: Record<string, unknown>) =>
		[...offerKeys.lists(), ...(filters ? [filters] : [])] as const,
	details: () => [...offerKeys.all, "detail"] as const,
	detail: (id: string) => [...offerKeys.details(), id] as const,
	products: (id: string) => [...offerKeys.all, "products", id] as const,
	productsDetails: (id: string) => [...offerKeys.products(id), "details"] as const,
};

// ── Query Options ───────────────────────────────────────

export function offerListQueryOptions(filters?: Record<string, string>) {
	return queryOptions({
		queryKey: offerKeys.list(filters),
		queryFn: () => offersService.list(filters),
		placeholderData: keepPreviousData,
		staleTime: 1000 * 60 * 5, // 5 min
	});
}

// ── Queries ────────────────────────────────────────────

export function useOffers(filters?: Record<string, string>) {
	return useQuery(offerListQueryOptions(filters));
}

export function useOffer(id: string) {
	return useQuery({
		queryKey: offerKeys.detail(id),
		queryFn: () => offersService.getById(id),
		enabled: id.length > 0,
	});
}

// ── Detail queries (enhanced data) ─────────────────

export function useOfferProductsWithDetails(id: string) {
	return useQuery({
		queryKey: offerKeys.productsDetails(id),
		queryFn: () => offersService.getProducts(id),
		enabled: id.length > 0,
	});
}
