import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { AUTO_CANCEL_MS } from "@renovabit/db/constants";
import { ORDER_STATUS_TRANSITIONS } from "@renovabit/db/orders";
import { ORDER_STATUS_LABELS } from "@renovabit/db/orders-meta";
import { orderItems, orders, products } from "@renovabit/db/schema";
import { type Static } from "@sinclair/typebox";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { removeOrderAutoCancel } from "@/jobs/orders.queue";
import { notifyAdminsOfCancelledOrder } from "@/modules/notifications/notifications.service";
import { logger } from "@/utils/logger";
import type { OrderResponse } from "../model";
import { OrderModel } from "../model";
import { AUTO_CANCEL_REASON } from "./internal";
import { getById } from "./queries";

type AdminUpdateBody = Static<typeof OrderModel.adminUpdateBody>;

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

	const isStatusChanging = data.status !== order.status;

	if (isStatusChanging) {
		const allowed = ORDER_STATUS_TRANSITIONS[order.status] ?? [];
		if (!allowed.includes(data.status)) {
			throw createApiError({
				code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
				message: `No se puede cambiar el estado de "${order.status}" a "${data.status}"`,
				logLevel: "info",
				doNotLog: true,
			});
		}
	}

	const now = new Date();
	const updates: Partial<typeof orders.$inferInsert> = {
		updatedAt: now,
	};

	if (isStatusChanging) {
		updates.status = data.status;
		if (data.status === "confirmed") {
			updates.confirmedAt = now;
		}
		if (data.status === "cancelled") {
			updates.cancelledAt = now;
			updates.cancelReason = data.cancelReason ?? null;
		}

		const dateStr = new Intl.DateTimeFormat("es-PE", {
			timeZone: "America/Lima",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		}).format(now);
		const systemNote = `[${dateStr}] Sistema: Pedido ${(ORDER_STATUS_LABELS[data.status] ?? data.status).toLowerCase()}`;
		const existingNotes = order.adminNotes ?? "";
		const adminProvidedNotes = data.adminNotes !== undefined ? data.adminNotes : "";
		const combinedNotes = [adminProvidedNotes, existingNotes, systemNote]
			.filter(Boolean)
			.join("\n");
		updates.adminNotes = combinedNotes || systemNote;
	}
	if (data.adminNotes !== undefined && !isStatusChanging) {
		updates.adminNotes = data.adminNotes;
	}

	if (isStatusChanging) {
		// Owner-managed products (`manual`) are the only ones whose stock moves
		// with order state: confirming consumes it, cancelling/refunding a
		// confirmed order returns it. Provider products never move local stock —
		// the feed owns it and availability derives from holds (utils/stock.ts).
		const manualItems = await db
			.select({
				productId: orderItems.productId,
				quantity: orderItems.quantity,
				productName: orderItems.productName,
			})
			.from(orderItems)
			.innerJoin(products, eq(products.id, orderItems.productId))
			.where(and(eq(orderItems.orderId, orderId), eq(products.managedBy, "manual")));

		await db.transaction(async (tx) => {
			// Claim the transition atomically: only one writer may move the order
			// out of the status this request validated against — concurrent
			// confirms converge to a single transition.
			const claimed = await tx
				.update(orders)
				.set(updates)
				.where(and(eq(orders.id, orderId), eq(orders.status, order.status)))
				.returning({ id: orders.id });

			if (claimed.length === 0) {
				throw createApiError({
					code: BackendErrorCodes.CONFLICT,
					message:
						"El pedido cambió de estado mientras lo actualizabas. Actualiza e intenta nuevamente.",
					logLevel: "info",
					doNotLog: true,
				});
			}

			if (manualItems.length > 0) {
				if (data.status === "confirmed") {
					for (const item of manualItems) {
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
					for (const item of manualItems) {
						if (!item.productId) continue;
						await tx
							.update(products)
							.set({ stock: sql`${products.stock} + ${item.quantity}` })
							.where(eq(products.id, item.productId));
					}
				}
			}
		});
	} else {
		await db.update(orders).set(updates).where(eq(orders.id, orderId));
	}

	if (isStatusChanging && order.status === "pending") {
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
//  USER CANCEL
// ═══════════════════════════════════════════════════

const USER_CANCEL_REASON = "Cancelado por el cliente";

async function cancelByUser(orderId: string, userId: string): Promise<OrderResponse> {
	const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

	if (!order) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Pedido no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	if (order.userId !== userId) {
		throw createApiError({
			code: BackendErrorCodes.ACCESS_DENIED,
			message: "Este pedido no te pertenece",
			logLevel: "info",
			doNotLog: true,
		});
	}

	if (order.status !== "pending") {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "Solo puedes cancelar pedidos pendientes",
			logLevel: "info",
			doNotLog: true,
		});
	}

	if (Date.now() - order.createdAt.getTime() >= AUTO_CANCEL_MS) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "El pedido ya no puede cancelarse porque superó el plazo de 2 días",
			logLevel: "info",
			doNotLog: true,
		});
	}

	const now = new Date();
	const [updated] = await db
		.update(orders)
		.set({
			status: "cancelled",
			cancelledAt: now,
			cancelReason: USER_CANCEL_REASON,
			updatedAt: now,
		})
		.where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
		.returning({ id: orders.id });

	if (!updated) {
		// Already cancelled (admin or auto-cancel) between read and write.
		// Return current state truthfully instead of pretending user cancelled it.
		const current = await getById(orderId);
		if (current) return current;
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al cancelar el pedido",
		});
	}

	removeOrderAutoCancel(orderId).catch((err) =>
		logger
			.withMetadata({ orderId })
			.withError(err)
			.warn("[Orders] failed to remove auto-cancel job"),
	);

	// Admins may be mid-confirmation for this order — tell them it is gone.
	notifyAdminsOfCancelledOrder({
		orderId,
		orderNumber: order.orderNumber,
		reason: USER_CANCEL_REASON,
	}).catch((err) =>
		logger
			.withMetadata({ orderId })
			.withError(err)
			.error("[Orders] Failed to notify admins of user cancel"),
	);

	// Non-admin view: admin notes must never reach the order owner.
	const refreshed = await getById(orderId);
	if (!refreshed) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al cancelar el pedido",
		});
	}

	return refreshed;
}

// ═══════════════════════════════════════════════════
//  AUTO-CANCEL
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

	notifyAdminsOfCancelledOrder({
		orderId,
		orderNumber: order.orderNumber,
		reason: AUTO_CANCEL_REASON,
	}).catch((err) =>
		logger
			.withMetadata({ orderId })
			.withError(err)
			.error("[Orders] Failed to notify admins of auto-cancel"),
	);

	return true;
}

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

	// Cancelamos los jobs delayed por orden para no desperdiciar lecturas en Redis
	// cuando dispare el worker (que ya sería no-op).
	await Promise.all(
		staleIds.map((id) =>
			removeOrderAutoCancel(id).catch((err) =>
				logger
					.withMetadata({ orderId: id })
					.withError(err)
					.warn("[Orders] failed to remove auto-cancel job (safety-net)"),
			),
		),
	);

	for (const row of stale) {
		notifyAdminsOfCancelledOrder({
			orderId: row.id,
			orderNumber: row.orderNumber,
			reason: AUTO_CANCEL_REASON,
		}).catch((err) =>
			logger
				.withMetadata({ orderId: row.id })
				.withError(err)
				.error("[Orders] Failed to notify admins of auto-cancel"),
		);
	}

	return staleIds;
}

// ═══════════════════════════════════════════════════
//  BATCH
// ═══════════════════════════════════════════════════

async function batchUpdate(
	ids: string[],
	action: "confirmed" | "cancelled" | "refunded",
): Promise<{ succeeded: string[]; failed: Array<{ id: string; reason: string }> }> {
	const succeeded: string[] = [];
	const failed: Array<{ id: string; reason: string }> = [];

	for (const id of ids) {
		try {
			await updateStatus(id, {
				status: action,
			});
			succeeded.push(id);
		} catch (err) {
			const reason = err instanceof Error ? err.message : "Error desconocido al procesar pedido";
			failed.push({ id, reason });
		}
	}

	return { succeeded, failed };
}

export { autoCancelExpiredPending, batchUpdate, cancelByUser, cancelIfStillPending, updateStatus };
