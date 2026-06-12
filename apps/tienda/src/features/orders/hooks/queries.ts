import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { api, unwrapResponse } from "@/shared/lib/api";

export const ORDER_STATUS_API = ["pending", "confirmed", "cancelled", "refunded"] as const;
export const ORDER_STATUS_UI = ["pendiente", "confirmado", "cancelado", "reembolsado"] as const;

type UIStatus = (typeof ORDER_STATUS_UI)[number];

const STATUS_UI_TO_API: Record<UIStatus, (typeof ORDER_STATUS_API)[number]> = {
	pendiente: "pending",
	confirmado: "confirmed",
	cancelado: "cancelled",
	reembolsado: "refunded",
};

export function statusUiToApi(value: string | undefined): OrderStatusFilter {
	if (!value) return undefined;
	return STATUS_UI_TO_API[value as UIStatus];
}

export type OrderStatusFilter = (typeof ORDER_STATUS_API)[number] | undefined;

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
