import { queryOptions } from "@tanstack/react-query";
import { api, getApiSsrHeaders, unwrapResponse } from "@/shared/lib/api";

type _CartResponseOrNull =
	Awaited<ReturnType<typeof api.api.v1.cart.get>> extends { data: infer T } ? T : never;
export type CartResponse = NonNullable<_CartResponseOrNull>;

// ── Query Keys Factory ───────────────────────────────────────

export const cartKeys = {
	all: ["cart"] as const,
	detail: () => [...cartKeys.all, "detail"] as const,
	total: () => [...cartKeys.all, "total"] as const,
};

// ── Query Options ─────────────────────────────────────────────

export const cartQueries = {
	detail: (guestToken?: string | null) =>
		queryOptions({
			queryKey: [...cartKeys.detail(), guestToken ?? "__session__"],
			queryFn: async () => {
				const headers = await getApiSsrHeaders();
				return unwrapResponse(
					api.api.v1.cart.get({
						headers,
						query: { guestToken: guestToken ?? undefined },
					}),
				);
			},
			staleTime: 0,
		}),

	total: (guestToken?: string | null) =>
		queryOptions({
			queryKey: [...cartKeys.total(), guestToken ?? "__session__"],
			queryFn: async () => {
				const headers = await getApiSsrHeaders();
				return unwrapResponse(
					api.api.v1.cart.total.get({
						headers,
						query: { guestToken: guestToken ?? undefined },
					}),
				);
			},
			staleTime: 1000 * 30,
		}),
};
