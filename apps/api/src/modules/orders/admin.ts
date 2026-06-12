import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia } from "elysia";
import { ErrorResponse, OrderModel } from "./model";
import { OrderService } from "./service";

// ═══════════════════════════════════════════════════
//  ADMIN — requiere isAdmin macro
//  Prefijo: /api/v1/admin/orders
// ═══════════════════════════════════════════════════

export const adminOrdersRoute = new Elysia({ prefix: "/orders" })
	// ── List ────────────────────────────────────
	.get(
		"/",
		async ({ query }) => {
			return OrderService.listAdmin({ status: query.status, page: query.page, limit: query.limit });
		},
		{
			isAdmin: true,
			query: OrderModel.adminListQuery,
			response: {
				200: OrderModel.orderListResponse,
				401: ErrorResponse,
				403: ErrorResponse,
			},
			detail: { summary: "Listar pedidos (admin)", tags: ["Orders"] },
		},
	)

	// ── Detail ──────────────────────────────────
	.get(
		"/:id",
		async ({ params: { id } }) => {
			const order = await OrderService.getById(id);
			if (!order) {
				throw createApiError({
					code: BackendErrorCodes.NOT_FOUND_ERROR,
					message: "Pedido no encontrado",
					logLevel: "info",
					doNotLog: true,
				});
			}
			return order;
		},
		{
			isAdmin: true,
			params: OrderModel.idParams,
			response: {
				200: OrderModel.orderResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Detalle de pedido (admin)", tags: ["Orders"] },
		},
	)

	// ── Update Status ───────────────────────────
	.patch(
		"/:id",
		async ({ params: { id }, body }) => {
			return OrderService.updateStatus(id, body);
		},
		{
			isAdmin: true,
			params: OrderModel.idParams,
			body: OrderModel.adminUpdateBody,
			response: {
				200: OrderModel.orderResponse,
				400: ErrorResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
				422: ErrorResponse,
			},
			detail: { summary: "Actualizar estado del pedido (admin)", tags: ["Orders"] },
		},
	);
