import { ORDER_STATUSES, type OrderStatus } from "@renovabit/db/orders";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { api } from "@/shared/lib/api/api-client";

function toOrderStatus(s: string | undefined): OrderStatus | undefined {
	if (!s) return undefined;
	return ORDER_STATUSES.find((valid) => valid === s);
}

export const getOrderDetailServerFn = createServerFn({ method: "GET" })
	.validator((input: { id: string }) => input)
	.handler(async ({ data: { id } }) => {
		const reqHeaders = getRequestHeaders();
		const cookie = reqHeaders.get("cookie") ?? "";

		const { data, error } = await api.api.v1.orders({ id }).get({
			headers: { cookie },
		});

		if (error || !data)
			return { order: null, errorCode: error?.status ? String(error.status) : undefined };
		return { order: data, errorCode: undefined };
	});

export const getOrderListServerFn = createServerFn({ method: "GET" })
	.validator(({ page, pageSize, status }: { page: number; pageSize: number; status?: string }) => ({
		page,
		pageSize,
		status,
	}))
	.handler(async ({ data: { page, pageSize, status } }) => {
		const reqHeaders = getRequestHeaders();
		const cookie = reqHeaders.get("cookie") ?? "";

		const { data, error } = await api.api.v1.orders.get({
			headers: { cookie },
			query: {
				page: String(page),
				limit: String(pageSize),
				status: toOrderStatus(status),
			},
		});

		if (error || !data)
			return { data: null, errorCode: error?.status ? String(error.status) : undefined };
		return { data, errorCode: undefined };
	});
