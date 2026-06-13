import { type OrderSource, type OrderStatus, type PaymentMethod } from "@renovabit/db/orders";
import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";
import type { BatchActionResult, OrderDetail, OrderListResponse } from "../model";

// ── Body types derivados de Eden Treaty (SSOT con la API) ──

export type UpdateOrderStatusValues = Parameters<
	ReturnType<typeof api.api.v1.admin.orders>["patch"]
>[0];

export type UpdateOrderAttachmentsValues = Parameters<
	ReturnType<typeof api.api.v1.admin.orders>["attachments"]["patch"]
>[0];

// ── Query types ──

type AdminListQuery = {
	status?: OrderStatus;
	source?: OrderSource;
	paymentMethod?: PaymentMethod;
	from?: string;
	to?: string;
	page?: string;
	limit?: string;
	search?: string;
	sortBy?: "createdAt" | "total" | "orderNumber" | "status" | "customerName";
	sortOrder?: "asc" | "desc";
};

export type BatchActionStatus = Exclude<OrderStatus, "pending">;

// ── API Functions ────────────────────────────────────

async function list(options: AdminListQuery = {}): Promise<OrderListResponse> {
	const query: Record<string, string> = {};
	if (options.page) query.page = options.page;
	if (options.limit) query.limit = options.limit;
	if (options.status) query.status = options.status;
	if (options.source) query.source = options.source;
	if (options.paymentMethod) query.paymentMethod = options.paymentMethod;
	if (options.from) query.from = options.from;
	if (options.to) query.to = options.to;
	if (options.search) query.search = options.search;
	if (options.sortBy) query.sortBy = options.sortBy;
	if (options.sortOrder) query.sortOrder = options.sortOrder;

	return unwrapResponse(api.api.v1.admin.orders.get({ query }));
}

async function getById(id: string): Promise<OrderDetail> {
	return unwrapResponse(api.api.v1.admin.orders({ id }).get());
}

async function updateStatus(id: string, data: UpdateOrderStatusValues): Promise<OrderDetail> {
	return unwrapResponse(api.api.v1.admin.orders({ id }).patch(data));
}

async function updateAttachments(
	id: string,
	data: UpdateOrderAttachmentsValues,
): Promise<OrderDetail> {
	return unwrapResponse(api.api.v1.admin.orders({ id }).attachments.patch(data));
}

async function batchUpdate(ids: string[], action: BatchActionStatus): Promise<BatchActionResult> {
	return unwrapResponse(api.api.v1.admin.orders.batch.post({ ids, action }));
}

// ── Public API ──────────────────────────────────────

export const ordersService = {
	list,
	getById,
	updateStatus,
	updateAttachments,
	batchUpdate,
};
