/**
 * Offer TanStack Query options — wraps server functions for client consumption.
 */
import { queryOptions } from "@tanstack/react-query";
import { type GetOffersInput, getOffersWithProductsServerFn } from "./server";

// ── Query Keys Factory ───────────────────────────────────────

export const offerKeys = {
	all: ["offers"] as const,
	lists: () => [...offerKeys.all, "list"] as const,
	list: (input?: GetOffersInput) => [...offerKeys.lists(), input] as const,
};

// ── Query Options ─────────────────────────────────────────────

export const offerQueries = {
	/** Consolidated offer list with products */
	list: (input: GetOffersInput = {}) =>
		queryOptions({
			queryKey: offerKeys.list(input),
			queryFn: () => getOffersWithProductsServerFn({ data: input }),
			staleTime: 1000 * 60 * 2, // 2 min — offers change less frequently
		}),
};
