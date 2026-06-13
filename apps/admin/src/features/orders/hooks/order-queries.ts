import { type OrderSource, type OrderStatus, type PaymentMethod } from "@renovabit/db/orders";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { ordersService } from "../service/orders.service";

// ── Query Key Factory ──────────────────────────────────

export const orderKeys = {
	all: ["orders"] as const,
	lists: () => [...orderKeys.all, "list"] as const,
	list: (filters?: Record<string, unknown>) =>
		[...orderKeys.lists(), ...(filters ? [filters] : [])] as const,
	paginated: (params: {
		page: number;
		pageSize: number;
		status?: OrderStatus;
		source?: OrderSource;
		paymentMethod?: PaymentMethod;
		from?: string;
		to?: string;
		search?: string;
		sortBy?: "createdAt" | "total" | "orderNumber" | "status" | "customerName";
		sortOrder?: "asc" | "desc";
	}) => [...orderKeys.lists(), "paginated", params] as const,
	details: () => [...orderKeys.all, "detail"] as const,
	detail: (id: string) => [...orderKeys.details(), id] as const,
};

// ── Query Options — Tabla (server-side pagination) ─────

export function ordersPaginatedQueryOptions(params: {
	page: number;
	pageSize: number;
	status?: OrderStatus;
	source?: OrderSource;
	paymentMethod?: PaymentMethod;
	from?: string;
	to?: string;
	search?: string;
	sortBy?: "createdAt" | "total" | "orderNumber" | "status" | "customerName";
	sortOrder?: "asc" | "desc";
}) {
	return queryOptions({
		queryKey: orderKeys.paginated(params),
		queryFn: () =>
			ordersService.list({
				page: String(params.page),
				limit: String(params.pageSize),
				...(params.status ? { status: params.status } : {}),
				...(params.source ? { source: params.source } : {}),
				...(params.paymentMethod ? { paymentMethod: params.paymentMethod } : {}),
				...(params.from ? { from: params.from } : {}),
				...(params.to ? { to: params.to } : {}),
				...(params.search ? { search: params.search } : {}),
				...(params.sortBy ? { sortBy: params.sortBy } : {}),
				...(params.sortOrder ? { sortOrder: params.sortOrder } : {}),
			}),
		placeholderData: keepPreviousData,
		staleTime: 30_000,
	});
}

// ── Queries ────────────────────────────────────────────

export function usePaginatedOrders(params: {
	page: number;
	pageSize: number;
	status?: OrderStatus;
	source?: OrderSource;
	paymentMethod?: PaymentMethod;
	from?: string;
	to?: string;
	search?: string;
	sortBy?: "createdAt" | "total" | "orderNumber" | "status" | "customerName";
	sortOrder?: "asc" | "desc";
}) {
	return useQuery(ordersPaginatedQueryOptions(params));
}

export function orderQueryOptions(id: string) {
	return queryOptions({
		queryKey: orderKeys.detail(id),
		queryFn: () => ordersService.getById(id),
		enabled: id.length > 0,
	});
}

export function useOrder(id: string) {
	return useQuery(orderQueryOptions(id));
}
