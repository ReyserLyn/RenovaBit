import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia } from "elysia";
import { auth } from "@/utils/auth/auth";
import { logger } from "@/utils/logger";
import { ErrorResponse, OrderModel } from "./model";
import { OrderService } from "./service";

export const ordersRoute = new Elysia({ prefix: "/orders" })
	// ── Create Order ────────────────────────────
	.post(
		"/",
		async ({ body, request, set }) => {
			const session = await auth.api.getSession({ headers: request.headers });
			const userId = session?.user.id ?? null;

			const guestName = typeof body.customerName === "string" ? body.customerName.trim() : "";
			if (!userId && guestName.length === 0) {
				set.status = 400;
				return {
					errId: "missing-name",
					code: "INPUT_VALIDATION_ERROR",
					message: "Debes proporcionar tu nombre para crear el pedido",
					statusCode: 400,
				};
			}

			return OrderService.create(body, userId);
		},
		{
			body: OrderModel.createBody,
			response: {
				200: OrderModel.orderResponse,
				400: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
				422: ErrorResponse,
			},
			detail: { summary: "Crear pedido desde el carrito", tags: ["Orders"] },
		},
	)

	// ── User Order List ─────────────────────────
	.get(
		"/",
		async ({ query, request, set }) => {
			const session = await auth.api.getSession({ headers: request.headers });
			if (!session) {
				throw createApiError({
					code: BackendErrorCodes.INVALID_CREDENTIALS,
					message: "Inicia sesión para ver tus pedidos",
					logLevel: "info",
					doNotLog: true,
				});
			}

			set.headers["cache-control"] = "no-store";

			return OrderService.listByUser(session.user.id, query.page, query.limit, query.status);
		},
		{
			query: OrderModel.listQuery,
			response: { 200: OrderModel.orderListResponse, 401: ErrorResponse },
			detail: { summary: "Listar pedidos del usuario", tags: ["Orders"] },
		},
	)

	// ── Order Detail ────────────────────────────
	.get(
		"/:id",
		async ({ params: { id }, request, set }) => {
			const session = await auth.api.getSession({ headers: request.headers });
			if (!session) {
				throw createApiError({
					code: BackendErrorCodes.INVALID_CREDENTIALS,
					message: "Inicia sesión para ver el detalle del pedido",
					logLevel: "info",
					doNotLog: true,
				});
			}

			const order = await OrderService.getById(id);
			if (!order) {
				throw createApiError({
					code: BackendErrorCodes.NOT_FOUND_ERROR,
					message: "Pedido no encontrado",
					logLevel: "info",
					doNotLog: true,
				});
			}

			const isAdmin = session.user.role === "admin";
			const isOwner = !!order.userId && order.userId === session.user.id;

			if (!isAdmin && !isOwner) {
				logger
					.withMetadata({
						event: "order.access_denied",
						actorId: session.user.id,
						actorRole: session.user.role,
						orderId: order.id,
						orderOwnerId: order.userId,
					})
					.warn("Intento de acceso a pedido ajeno");
				throw createApiError({
					code: BackendErrorCodes.ACCESS_DENIED,
					message: "Este pedido no te pertenece",
					logLevel: "info",
					doNotLog: true,
				});
			}

			set.headers["cache-control"] = "no-store";

			return order;
		},
		{
			params: OrderModel.idParams,
			response: {
				200: OrderModel.orderResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Detalle del pedido", tags: ["Orders"] },
		},
	);
