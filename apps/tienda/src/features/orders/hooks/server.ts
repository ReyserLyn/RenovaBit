import { createServerFn } from "@tanstack/react-start";
import { ssrFetch } from "@/shared/lib/api/ssr-fetch";
import type { OrderDetailResponse, OrderListPage } from "./queries";

export const getOrderDetailServerFn = createServerFn({ method: "GET" })
	.validator((input: { id: string }) => input)
	.handler(
		async ({
			data: { id },
		}): Promise<{ order: OrderDetailResponse | null; errorCode?: string }> => {
			const { data, errorCode } = await ssrFetch<OrderDetailResponse>(`/api/v1/orders/${id}`);
			return { order: data, errorCode };
		},
	);

export const getOrderListServerFn = createServerFn({ method: "GET" })
	.validator(({ page, pageSize }: { page: number; pageSize: number }) => ({ page, pageSize }))
	.handler(
		async ({
			data: { page, pageSize },
		}): Promise<{ data: OrderListPage | null; errorCode?: string }> => {
			return ssrFetch<OrderListPage>(`/api/v1/orders/?page=${page}&limit=${pageSize}`);
		},
	);
