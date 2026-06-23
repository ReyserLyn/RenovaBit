import type { OrderStatus } from "@renovabit/db/orders";
import { STATUS_URL_TO_API } from "@renovabit/db/orders-meta";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { api, unwrapResponse } from "@/shared/lib/api";

export type OrderStatusFilter = OrderStatus | undefined;

export function statusUiToApi(value: string | undefined): OrderStatusFilter {
	if (!value) return undefined;
	const entry = Object.entries(STATUS_URL_TO_API).find(([key]) => key === value);
	return entry ? entry[1] : undefined;
}

// ── Query Keys Factory ───────────────────────────────────────

export const orderKeys = {
	all: ["orders"] as const,
	lists: () => [...orderKeys.all, "list"] as const,
	infiniteList: (pageSize = 10, status?: OrderStatusFilter) => {
		const key: unknown[] = [...orderKeys.lists(), "infinite", pageSize];
		if (status) key.push(status);
		return key;
	},
	details: () => [...orderKeys.all, "detail"] as const,
	detail: (id: string) => [...orderKeys.details(), id] as const,
};

// ── Query Options ─────────────────────────────────────────────

export const orderQueries = {
	infiniteList: (pageSize = 10, status?: OrderStatusFilter) =>
		infiniteQueryOptions({
			queryKey: orderKeys.infiniteList(pageSize, status),
			queryFn: ({ pageParam }) =>
				unwrapResponse(
					api.api.v1.orders.get({
						query: {
							page: String(pageParam),
							limit: String(pageSize),
							...(status ? { status } : {}),
						},
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
