import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";
import type { BatchActionResult, OrderDetail, OrderListResponse, OrderStatus } from "../model";

// ── Body types derivados de Eden Treaty (SSOT con la API) ──

export type UpdateOrderStatusValues = Parameters<
	ReturnType<typeof api.api.v1.admin.orders>["patch"]
>[0];

// ── Query types ──

type AdminListQuery = {
	status?: OrderStatus;
	page?: string;
	limit?: string;
	search?: string;
};

export type BatchActionStatus = Exclude<OrderStatus, "pending">;

// ── API Functions ────────────────────────────────────

async function list(options: AdminListQuery = {}): Promise<OrderListResponse> {
	return unwrapResponse(api.api.v1.admin.orders.get({ query: options }));
}

async function getById(id: string): Promise<OrderDetail> {
	return unwrapResponse(api.api.v1.admin.orders({ id }).get());
}

async function updateStatus(id: string, data: UpdateOrderStatusValues): Promise<OrderDetail> {
	return unwrapResponse(api.api.v1.admin.orders({ id }).patch(data));
}

async function batchUpdate(ids: string[], action: BatchActionStatus): Promise<BatchActionResult> {
	return unwrapResponse(api.api.v1.admin.orders.batch.post({ ids, action }));
}

// ── Public API ──────────────────────────────────────

export const ordersService = {
	list,
	getById,
	updateStatus,
	batchUpdate,
};
