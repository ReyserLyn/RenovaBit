import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { api, unwrapResponse } from "@/shared/lib/api";

// ── Query Keys Factory ───────────────────────────────────────

export const orderKeys = {
	all: ["orders"] as const,
	lists: () => [...orderKeys.all, "list"] as const,
	infiniteList: (pageSize = 10) => [...orderKeys.lists(), "infinite", pageSize] as const,
	details: () => [...orderKeys.all, "detail"] as const,
	detail: (id: string) => [...orderKeys.details(), id] as const,
};

// ── Query Options ─────────────────────────────────────────────

export const orderQueries = {
	infiniteList: (pageSize = 10) =>
		infiniteQueryOptions({
			queryKey: orderKeys.infiniteList(pageSize),
			queryFn: ({ pageParam }) =>
				unwrapResponse(
					api.api.v1.orders.get({
						query: { page: String(pageParam), limit: String(pageSize) },
					}),
				),
			initialPageParam: 0,
			getNextPageParam: (lastPage, allPages) => {
				const nextPage = allPages.length;
				return nextPage * pageSize < lastPage.total ? nextPage : undefined;
			},
			placeholderData: (previousData) => previousData,
			staleTime: 1000 * 60,
		}),

	detail: (id: string) =>
		queryOptions({
			queryKey: orderKeys.detail(id),
			queryFn: () => unwrapResponse(api.api.v1.orders({ id }).get()),
			staleTime: 1000 * 60,
		}),
};

export type OrderListPage = Awaited<
	ReturnType<NonNullable<ReturnType<typeof orderQueries.infiniteList>["queryFn"]>>
>;
export type OrderDetailResponse = Awaited<
	ReturnType<NonNullable<ReturnType<typeof orderQueries.detail>["queryFn"]>>
>;
