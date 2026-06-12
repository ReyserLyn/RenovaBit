import { queryOptions } from "@tanstack/react-query";
import { api, unwrapResponse } from "@/shared/lib/api";

type _CartResponseOrNull =
	Awaited<ReturnType<typeof api.api.v1.cart.get>> extends { data: infer T } ? T : never;
export type CartResponse = NonNullable<_CartResponseOrNull>;

export type CartTotalResponse =
	Awaited<ReturnType<typeof api.api.v1.cart.total.get>> extends { data: infer T } ? T : never;

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
			queryFn: () =>
				unwrapResponse(
					api.api.v1.cart.get({
						query: { guestToken: guestToken ?? undefined },
					}),
				),
			staleTime: 0,
		}),

	total: (guestToken?: string | null) =>
		queryOptions({
			queryKey: [...cartKeys.total(), guestToken ?? "__session__"],
			queryFn: () =>
				unwrapResponse(
					api.api.v1.cart.total.get({
						query: { guestToken: guestToken ?? undefined },
					}),
				),
			staleTime: 1000 * 30,
		}),
};
