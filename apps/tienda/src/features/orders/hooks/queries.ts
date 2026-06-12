import { queryOptions } from "@tanstack/react-query";
import { api, unwrapResponse } from "@/shared/lib/api";

// ── Query Keys Factory ───────────────────────────────────────

export const orderKeys = {
	all: ["orders"] as const,
	lists: () => [...orderKeys.all, "list"] as const,
	list: (page = 0, limit = 10) => [...orderKeys.lists(), page, limit] as const,
	details: () => [...orderKeys.all, "detail"] as const,
	detail: (id: string) => [...orderKeys.details(), id] as const,
};

// ── Query Options ─────────────────────────────────────────────

export const orderQueries = {
	list: (page = 0, limit = 10) =>
		queryOptions({
			queryKey: orderKeys.list(page, limit),
			queryFn: () =>
				unwrapResponse(
					api.api.v1.orders.get({
						query: { page: String(page), limit: String(limit) },
					}),
				),
			staleTime: 1000 * 60,
		}),

	detail: (id: string) =>
		queryOptions({
			queryKey: orderKeys.detail(id),
			queryFn: () => unwrapResponse(api.api.v1.orders({ id }).get()),
			staleTime: 1000 * 60,
		}),
};
