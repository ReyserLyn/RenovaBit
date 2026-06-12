import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { cartItems, carts, orderItems, orders, products } from "@renovabit/db/schema";
import { and, asc, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { enqueueOrderAutoCancel, removeOrderAutoCancel } from "@/jobs/orders.queue";
import { createNotification, getAdminIds } from "@/modules/notifications/notifications.service";
import { broadcastToAdmins } from "@/plugins/websocket";
import { logger } from "@/utils/logger";
import type { OrderListItem, OrderModel, OrderResponse } from "./model";

type CreateBody = OrderModel["createBody"];
type AdminUpdateBody = OrderModel["adminUpdateBody"];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const ORDER_SUFFIX = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 10);

/** Pedidos `pending` más antiguos que esto se cancelan automáticamente. */
export const AUTO_CANCEL_MS = 2 * 24 * 60 * 60 * 1000; // 2 días
const AUTO_CANCEL_REASON = "Cancelado automáticamente por falta de confirmación";

function formatDate(date: Date): string {
	return date.toISOString();
}

function generateOrderNumber(): string {
	const year = new Date().getFullYear();
	return `ORD-${year}-${ORDER_SUFFIX()}`;
}

function isOrderNumberUniqueViolation(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const e = error as { code?: unknown; constraint?: unknown; message?: unknown };
	const code = typeof e.code === "string" ? e.code : "";
	const constraint = typeof e.constraint === "string" ? e.constraint : "";
	const message = typeof e.message === "string" ? e.message : "";
	return (
		code === "23505" &&
		(constraint === "orders_order_number_unique" || message.includes("orders_order_number_unique"))
	);
}

function sanitizePagination(
	page: string | number | undefined = 0,
	limit: string | number | undefined = DEFAULT_PAGE_SIZE,
) {
	const parsedPage =
		typeof page === "string" ? Number.parseInt(page ?? "0", 10) : (page as number | undefined);
	const parsedLimit =
		typeof limit === "string"
			? Number.parseInt(limit ?? String(DEFAULT_PAGE_SIZE), 10)
			: (limit as number | undefined);

	const safePage =
		Number.isFinite(parsedPage as number) && (parsedPage as number) >= 0
			? Math.trunc(parsedPage as number)
			: 0;
	const requestedLimit =
		Number.isFinite(parsedLimit as number) && (parsedLimit as number) > 0
			? Math.trunc(parsedLimit as number)
			: DEFAULT_PAGE_SIZE;
	const safeLimit = Math.min(requestedLimit, MAX_PAGE_SIZE);
	return { safePage, safeLimit, offset: safePage * safeLimit };
}

type OrderRow = typeof orders.$inferSelect;

async function buildOrderResponse(order: OrderRow): Promise<OrderResponse> {
	const items = await db
		.select()
		.from(orderItems)
		.where(eq(orderItems.orderId, order.id))
		.orderBy(asc(orderItems.createdAt));

	return {
		id: order.id,
		userId: order.userId ?? null,
		orderNumber: order.orderNumber,
		status: order.status,
		source: order.source,
		paymentMethod: order.paymentMethod ?? null,
		paymentProofUrl: null, // TODO: populate when payment proof upload supported
		customerName: order.customerName ?? null,
		customerPhone: order.customerPhone ?? null,
		subtotal: order.subtotal,
		discountTotal: order.discountTotal,
		total: order.total,
		notes: order.notes ?? null,
		adminNotes: order.adminNotes ?? null,
		items: items.map((i) => ({
			id: i.id,
			productId: i.productId ?? null,
			productName: i.productName,
			productSku: i.productSku,
			quantity: i.quantity,
			unitPrice: i.unitPrice,
			finalPrice: i.finalPrice,
		})),
		createdAt: formatDate(order.createdAt),
		confirmedAt: order.confirmedAt ? formatDate(order.confirmedAt) : null,
		cancelledAt: order.cancelledAt ? formatDate(order.cancelledAt) : null,
		cancelReason: order.cancelReason ?? null,
	};
}

// ═══════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════

async function notifyAdmins(
	orderId: string,
	orderNumber: string,
	total: string,
	customerName: string | null,
): Promise<void> {
	const adminIds = await getAdminIds();
	if (adminIds.length === 0) return;

	for (const adminId of adminIds) {
		try {
			await createNotification({
				userId: adminId,
				type: "order_created",
				title: "Nuevo pedido recibido",
				message: `Pedido ${orderNumber} — S/ ${total}${customerName ? ` — ${customerName}` : ""}`,
				data: { orderId, orderNumber, total },
			});
		} catch (err) {
			logger.withMetadata({ adminId, err }).error("[Order] Failed to notify admin");
		}
	}

	broadcastToAdmins({
		type: "order:created",
		orderId,
		orderNumber,
		total,
		timestamp: new Date().toISOString(),
	});
}

// ═══════════════════════════════════════════════════
//  CREATE ORDER
// ═══════════════════════════════════════════════════

async function create(data: CreateBody, userId: string | null): Promise<OrderResponse> {
	const [cartRow] = await db
		.select({ id: carts.id, userId: carts.userId, guestToken: carts.guestToken })
		.from(carts)
		.where(eq(carts.id, data.cartId))
		.limit(1);

	if (!cartRow) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Carrito no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	if (userId) {
		if (cartRow.userId && cartRow.userId !== userId) {
			throw createApiError({
				code: BackendErrorCodes.ACCESS_DENIED,
				message: "Este carrito no pertenece al usuario actual",
				logLevel: "info",
				doNotLog: true,
			});
		}

		if (!cartRow.userId) {
			if (!data.guestToken || cartRow.guestToken !== data.guestToken) {
				throw createApiError({
					code: BackendErrorCodes.ACCESS_DENIED,
					message: "Este carrito no pertenece al usuario actual",
					logLevel: "info",
					doNotLog: true,
				});
			}
		}
	} else {
		if (!data.guestToken || cartRow.guestToken !== data.guestToken) {
			throw createApiError({
				code: BackendErrorCodes.ACCESS_DENIED,
				message: "Este carrito no pertenece al token proporcionado",
				logLevel: "info",
				doNotLog: true,
			});
		}
	}

	const cartItemsList = await db
		.select({
			itemId: cartItems.id,
			productId: cartItems.productId,
			quantity: cartItems.quantity,
			addedAtPrice: cartItems.addedAtPrice,
		})
		.from(cartItems)
		.where(eq(cartItems.cartId, data.cartId));

	if (cartItemsList.length === 0) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "El carrito está vacío",
			logLevel: "info",
			doNotLog: true,
		});
	}

	const productIds = cartItemsList.map((i) => i.productId);
	const productRows = await db
		.select({
			id: products.id,
			name: products.name,
			slug: products.slug,
			sku: products.sku,
			price: products.price,
			stock: products.stock,
			isActive: products.isActive,
			needsReview: products.needsReview,
		})
		.from(products)
		.where(inArray(products.id, productIds));

	const productMap = new Map(productRows.map((p) => [p.id, p]));

	for (const item of cartItemsList) {
		const product = productMap.get(item.productId);
		if (!product) {
			throw createApiError({
				code: BackendErrorCodes.UNPROCESSABLE_ENTITY,
				message: "Uno o más productos ya no existen",
				logLevel: "info",
				doNotLog: true,
			});
		}
		if (!product.isActive || product.needsReview) {
			throw createApiError({
				code: BackendErrorCodes.UNPROCESSABLE_ENTITY,
				message: `"${product.name}" ya no está disponible`,
				logLevel: "info",
				doNotLog: true,
			});
		}
		if (product.stock < item.quantity) {
			throw createApiError({
				code: BackendErrorCodes.UNPROCESSABLE_ENTITY,
				message: `Stock insuficiente para "${product.name}". Disponible: ${product.stock}`,
				logLevel: "info",
				doNotLog: true,
			});
		}
	}

	const now = new Date();
	const customerName =
		typeof data.customerName === "string" ? data.customerName.trim() || null : null;
	const customerPhone =
		typeof data.customerPhone === "string" ? data.customerPhone.trim() || null : null;
	const normalizedNotes = typeof data.notes === "string" ? data.notes.trim() || null : null;

	const orderResult = await db.transaction(async (tx) => {
		let order:
			| {
					id: string;
					userId: string | null;
					orderNumber: string;
					status: "pending" | "confirmed" | "cancelled" | "refunded";
					source: "web" | "whatsapp";
					paymentMethod: "cash" | "transfer" | "yape" | "plin" | null;
					subtotal: string;
					discountTotal: string;
					total: string;
					notes: string | null;
					customerName: string | null;
					customerPhone: string | null;
					createdAt: Date;
			  }
			| undefined;

		for (let attempt = 0; attempt < 5; attempt++) {
			const orderNumber = generateOrderNumber();
			try {
				const [created] = await tx
					.insert(orders)
					.values({
						userId: userId ?? null,
						orderNumber,
						source: "web",
						paymentMethod: data.paymentMethod as
							| "cash"
							| "transfer"
							| "yape"
							| "plin"
							| null
							| undefined,
						customerName,
						customerPhone,
						subtotal: "0",
						discountTotal: "0",
						total: "0",
						notes: normalizedNotes,
						metadata: {},
						createdAt: now,
						updatedAt: now,
					})
					.returning({
						id: orders.id,
						userId: orders.userId,
						orderNumber: orders.orderNumber,
						status: orders.status,
						source: orders.source,
						paymentMethod: orders.paymentMethod,
						subtotal: orders.subtotal,
						discountTotal: orders.discountTotal,
						total: orders.total,
						notes: orders.notes,
						customerName: orders.customerName,
						customerPhone: orders.customerPhone,
						createdAt: orders.createdAt,
					});

				order = created;
				break;
			} catch (err) {
				if (!isOrderNumberUniqueViolation(err) || attempt === 4) throw err;
			}
		}

		if (!order) {
			throw createApiError({
				code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
				message: "Error al crear el pedido",
			});
		}

		let subtotal = 0;
		const createdItems: Array<{
			id: string;
			productId: string | null;
			productName: string;
			productSku: string;
			quantity: number;
			unitPrice: string;
			finalPrice: string;
		}> = [];

		for (const item of cartItemsList) {
			const product = productMap.get(item.productId)!;
			const qty = item.quantity;
			const unitPrice = parseFloat(item.addedAtPrice);
			const finalPrice = unitPrice * qty;
			subtotal += finalPrice;

			const [insertedItem] = await tx
				.insert(orderItems)
				.values({
					orderId: order.id,
					productId: item.productId,
					productName: product.name,
					productSku: product.sku,
					quantity: qty,
					unitPrice: item.addedAtPrice,
					finalPrice: finalPrice.toFixed(2),
				})
				.returning({ id: orderItems.id });

			if (!insertedItem) {
				throw createApiError({
					code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
					message: "Error al crear los items del pedido",
				});
			}

			createdItems.push({
				id: insertedItem.id,
				productId: item.productId,
				productName: product.name,
				productSku: product.sku,
				quantity: item.quantity,
				unitPrice: item.addedAtPrice,
				finalPrice: (unitPrice * item.quantity).toFixed(2),
			});
		}

		const total = subtotal.toFixed(2);

		await tx.update(orders).set({ subtotal: total, total }).where(eq(orders.id, order.id));
		const deletedCartItems = await tx
			.delete(cartItems)
			.where(eq(cartItems.cartId, data.cartId))
			.returning({ id: cartItems.id });

		if (deletedCartItems.length !== cartItemsList.length) {
			throw createApiError({
				code: BackendErrorCodes.UNPROCESSABLE_ENTITY,
				message: "El carrito cambió mientras procesábamos tu pedido. Intenta nuevamente",
				logLevel: "info",
				doNotLog: true,
			});
		}

		await tx
			.update(carts)
			.set({ itemsCount: 0, lastActivityAt: now })
			.where(eq(carts.id, data.cartId));

		order.subtotal = total;
		order.total = total;

		return { order, items: createdItems };
	});

	notifyAdmins(
		orderResult.order.id,
		orderResult.order.orderNumber,
		orderResult.order.total,
		customerName,
	).catch((err) => logger.withMetadata({ err }).error("[Order] Notification error"));

	enqueueOrderAutoCancel(orderResult.order.id, AUTO_CANCEL_MS).catch((err) =>
		logger
			.withMetadata({ err, orderId: orderResult.order.id })
			.warn("[Order] auto-cancel schedule failed"),
	);

	return {
		id: orderResult.order.id,
		userId: orderResult.order.userId ?? null,
		orderNumber: orderResult.order.orderNumber,
		status: orderResult.order.status,
		source: orderResult.order.source,
		paymentMethod: orderResult.order.paymentMethod ?? null,
		paymentProofUrl: null, // TODO: populate when payment proof upload supported
		customerName: orderResult.order.customerName ?? null,
		customerPhone: orderResult.order.customerPhone ?? null,
		subtotal: orderResult.order.subtotal,
		discountTotal: orderResult.order.discountTotal,
		total: orderResult.order.total,
		notes: orderResult.order.notes ?? null,
		adminNotes: null,
		items: orderResult.items,
		createdAt: formatDate(orderResult.order.createdAt),
		confirmedAt: null,
		cancelledAt: null,
		cancelReason: null,
	};
}

// ═══════════════════════════════════════════════════
//  GET ORDER
// ═══════════════════════════════════════════════════

async function getById(orderId: string): Promise<OrderResponse | null> {
	const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

	if (!order) return null;

	// Lazy auto-cancel: si está pending y venció, lo cancelamos antes de devolver
	if (order.status === "pending" && Date.now() - order.createdAt.getTime() >= AUTO_CANCEL_MS) {
		const now = new Date();
		await db
			.update(orders)
			.set({
				status: "cancelled",
				cancelledAt: now,
				cancelReason: AUTO_CANCEL_REASON,
				updatedAt: now,
			})
			.where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
		const [refreshed] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
		if (!refreshed) return null;
		return buildOrderResponse(refreshed);
	}

	return buildOrderResponse(order);
}

// ═══════════════════════════════════════════════════
//  LIST ORDERS (USER)
// ═══════════════════════════════════════════════════

async function listByUser(
	userId: string,
	page: string | number | undefined,
	limit: string | number | undefined,
): Promise<{ orders: OrderListItem[]; total: number }> {
	// Antes de listar, cancelamos los pending vencidos (idempotente, fire-and-forget)
	autoCancelExpiredPending().catch((err) =>
		logger.withError(err).warn("[Orders] autoCancel en listByUser falló"),
	);

	// sanitizePagination accepts string|number
	const { safeLimit, offset } = sanitizePagination(page, limit);

	const [countRow] = await db
		.select({ total: count(orders.id) })
		.from(orders)
		.where(eq(orders.userId, userId));

	const total = Number(countRow?.total ?? 0);

	const rows = await db
		.select({
			id: orders.id,
			orderNumber: orders.orderNumber,
			status: orders.status,
			source: orders.source,
			total: orders.total,
			customerName: orders.customerName,
			createdAt: orders.createdAt,
		})
		.from(orders)
		.where(eq(orders.userId, userId))
		.orderBy(desc(orders.createdAt))
		.offset(offset)
		.limit(safeLimit);

	const orderIds = rows.map((r) => r.id);
	const itemsCounts: Record<string, number> = {};

	if (orderIds.length > 0) {
		const counts = await db
			.select({
				orderId: orderItems.orderId,
				qty: sql<number>`sum(${orderItems.quantity})::int`,
			})
			.from(orderItems)
			.where(inArray(orderItems.orderId, orderIds))
			.groupBy(orderItems.orderId);

		for (const c of counts) {
			itemsCounts[c.orderId] = c.qty;
		}
	}

	const ordersList = rows.map((row) => ({
		id: row.id,
		orderNumber: row.orderNumber,
		status: row.status,
		source: row.source,
		total: row.total,
		itemsCount: itemsCounts[row.id] ?? 0,
		customerName: row.customerName ?? null,
		createdAt: formatDate(row.createdAt),
	}));

	return { orders: ordersList, total };
}

// ═══════════════════════════════════════════════════
//  LIST ORDERS (ADMIN)
// ═══════════════════════════════════════════════════

async function listAdmin(
	options: {
		status?: "pending" | "confirmed" | "cancelled" | "refunded";
		page?: string | number | undefined;
		limit?: string | number | undefined;
	} = {},
): Promise<{ orders: OrderListItem[]; total: number }> {
	autoCancelExpiredPending().catch((err) =>
		logger.withError(err).warn("[Orders] autoCancel en listAdmin falló"),
	);

	const { safeLimit, offset } = sanitizePagination(options.page, options.limit);

	const conditions = [];
	if (options.status) {
		conditions.push(eq(orders.status, options.status));
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const [countRow] = await db
		.select({ total: count(orders.id) })
		.from(orders)
		.where(where);

	const total = Number(countRow?.total ?? 0);

	const rows = await db
		.select({
			id: orders.id,
			orderNumber: orders.orderNumber,
			status: orders.status,
			source: orders.source,
			total: orders.total,
			customerName: orders.customerName,
			createdAt: orders.createdAt,
		})
		.from(orders)
		.where(where)
		.orderBy(desc(orders.createdAt))
		.offset(offset)
		.limit(safeLimit);

	const orderIds = rows.map((r) => r.id);
	const itemsCounts: Record<string, number> = {};

	if (orderIds.length > 0) {
		const counts = await db
			.select({
				orderId: orderItems.orderId,
				qty: sql<number>`sum(${orderItems.quantity})::int`,
			})
			.from(orderItems)
			.where(inArray(orderItems.orderId, orderIds))
			.groupBy(orderItems.orderId);

		for (const c of counts) {
			itemsCounts[c.orderId] = c.qty;
		}
	}

	const ordersList = rows.map((row) => ({
		id: row.id,
		orderNumber: row.orderNumber,
		status: row.status,
		source: row.source,
		total: row.total,
		itemsCount: itemsCounts[row.id] ?? 0,
		customerName: row.customerName ?? null,
		createdAt: formatDate(row.createdAt),
	}));

	return { orders: ordersList, total };
}

// ═══════════════════════════════════════════════════
//  UPDATE ORDER STATUS (ADMIN)
// ═══════════════════════════════════════════════════

async function updateStatus(orderId: string, data: AdminUpdateBody): Promise<OrderResponse> {
	const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

	if (!order) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Pedido no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	const validTransitions: Record<string, string[]> = {
		pending: ["confirmed", "cancelled"],
		confirmed: ["cancelled", "refunded"],
		cancelled: [],
		refunded: [],
	};

	const allowed = validTransitions[order.status] ?? [];
	if (!allowed.includes(data.status)) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: `No se puede cambiar el estado de "${order.status}" a "${data.status}"`,
			logLevel: "info",
			doNotLog: true,
		});
	}

	const now = new Date();
	const updates: Record<string, unknown> = {
		status: data.status,
		updatedAt: now,
	};

	if (data.status === "confirmed") {
		updates.confirmedAt = now;
	}
	if (data.status === "cancelled") {
		updates.cancelledAt = now;
		updates.cancelReason = data.cancelReason ?? null;
	}
	if (data.adminNotes !== undefined) {
		updates.adminNotes = data.adminNotes;
	}

	const orderItemsList = await db
		.select({
			productId: orderItems.productId,
			quantity: orderItems.quantity,
			productName: orderItems.productName,
		})
		.from(orderItems)
		.where(eq(orderItems.orderId, orderId));

	await db.transaction(async (tx) => {
		if (data.status === "confirmed") {
			for (const item of orderItemsList) {
				if (!item.productId) continue;
				const updatedStock = await tx
					.update(products)
					.set({ stock: sql`${products.stock} - ${item.quantity}` })
					.where(and(eq(products.id, item.productId), gte(products.stock, item.quantity)))
					.returning({ id: products.id });

				if (updatedStock.length === 0) {
					throw createApiError({
						code: BackendErrorCodes.UNPROCESSABLE_ENTITY,
						message: `Stock insuficiente para "${item.productName}" al confirmar pedido`,
						logLevel: "info",
						doNotLog: true,
					});
				}
			}
		} else if (
			(data.status === "cancelled" || data.status === "refunded") &&
			order.status === "confirmed"
		) {
			for (const item of orderItemsList) {
				if (!item.productId) continue;
				await tx
					.update(products)
					.set({ stock: sql`${products.stock} + ${item.quantity}` })
					.where(eq(products.id, item.productId));
			}
		}

		await tx.update(orders).set(updates).where(eq(orders.id, orderId));
	});

	if (order.status === "pending") {
		removeOrderAutoCancel(orderId).catch((err) =>
			logger
				.withMetadata({ orderId })
				.withError(err)
				.warn("[Orders] failed to remove auto-cancel job"),
		);
	}

	const updated = await getById(orderId);
	if (!updated) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al actualizar el pedido",
		});
	}

	return updated;
}

// ═══════════════════════════════════════════════════
//  AUTO-CANCEL
// ═══════════════════════════════════════════════════

/**
 * Cancela automáticamente los pedidos en `pending` con más de
 * {@link AUTO_CANCEL_MS} de antigüedad. Idempotente: seguro de llamar
 * en cada read (lazy) o desde el job programado.
 *
 * @returns IDs de los pedidos cancelados en esta corrida
 */
async function autoCancelExpiredPending(): Promise<string[]> {
	const cutoff = new Date(Date.now() - AUTO_CANCEL_MS);
	const now = new Date();

	const stale = await db
		.update(orders)
		.set({
			status: "cancelled",
			cancelledAt: now,
			cancelReason: AUTO_CANCEL_REASON,
			updatedAt: now,
		})
		.where(and(eq(orders.status, "pending"), lt(orders.createdAt, cutoff)))
		.returning({ id: orders.id, orderNumber: orders.orderNumber });

	if (stale.length === 0) return [];

	const staleIds = stale.map((row) => row.id);

	logger
		.withMetadata({ count: stale.length, orderIds: staleIds })
		.info("[Orders] Auto-cancel de pedidos pendientes vencidos");

	for (const row of stale) {
		broadcastToAdmins({
			type: "order:auto-cancelled",
			orderId: row.id,
			orderNumber: row.orderNumber,
			reason: AUTO_CANCEL_REASON,
			timestamp: now.toISOString(),
		});
	}

	return staleIds;
}

// ═══════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════

/**
 * Cancela una orden específica si aún está `pending`. Usado por el worker
 * de auto-cancel per-orden. Idempotente.
 *
 * @returns `true` si la cancelación se aplicó en esta llamada
 */
async function cancelIfStillPending(orderId: string): Promise<boolean> {
	const [order] = await db
		.select({ status: orders.status, orderNumber: orders.orderNumber })
		.from(orders)
		.where(eq(orders.id, orderId))
		.limit(1);

	if (!order || order.status !== "pending") return false;

	const now = new Date();
	const updated = await db
		.update(orders)
		.set({
			status: "cancelled",
			cancelledAt: now,
			cancelReason: AUTO_CANCEL_REASON,
			updatedAt: now,
		})
		.where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
		.returning({ id: orders.id });

	if (updated.length === 0) return false;

	logger
		.withMetadata({ orderId, orderNumber: order.orderNumber })
		.info("[Orders] Auto-cancel aplicado por worker");

	broadcastToAdmins({
		type: "order:auto-cancelled",
		orderId,
		orderNumber: order.orderNumber,
		reason: AUTO_CANCEL_REASON,
		timestamp: now.toISOString(),
	});

	return true;
}

export const OrderService = {
	create,
	getById,
	listByUser,
	listAdmin,
	updateStatus,
	cancelIfStillPending,
	autoCancelExpiredPending,
};
