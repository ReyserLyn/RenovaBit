import { db } from "@renovabit/db";
import type {
	NotificationData,
	OrderNotificationData,
	SyncNotificationData,
	SyncStats,
} from "@renovabit/db/schema";
import { adminNotifications, users } from "@renovabit/db/schema";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { broadcastToAdmins } from "@/plugins/websocket";
import { logger } from "@/utils/logger";

export async function getAdminIds(): Promise<string[]> {
	const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
	return rows.map((r) => r.id);
}

export async function getNotifications(
	userId: string,
	page = 1,
	limit = 20,
	unreadOnly = false,
	search?: string,
) {
	// Bound search length so a long ILIKE pattern can't dominate the planner.
	const safeSearch = search?.trim().slice(0, 100) || undefined; // SEARCH_MAX_LENGTH = 100
	const where = and(
		eq(adminNotifications.userId, userId),
		...(unreadOnly ? [eq(adminNotifications.isRead, false)] : []),
		...(safeSearch
			? [
					or(
						sql`${adminNotifications.id}::text ILIKE ${`%${safeSearch}%`}`,
						sql`${adminNotifications.title} ILIKE ${`%${safeSearch}%`}`,
						sql`${adminNotifications.message} ILIKE ${`%${safeSearch}%`}`,
						sql`${adminNotifications.data}->>'jobId' ILIKE ${`%${safeSearch}%`}`,
						sql`${adminNotifications.data}->>'reportId' ILIKE ${`%${safeSearch}%`}`,
						sql`${adminNotifications.data}->>'orderId' ILIKE ${`%${safeSearch}%`}`,
						sql`${adminNotifications.data}->>'orderNumber' ILIKE ${`%${safeSearch}%`}`,
					),
				]
			: []),
	);

	// Single query with aggregations — replaces the previous 3-round-trip pattern
	const rows = await db
		.select({
			id: adminNotifications.id,
			userId: adminNotifications.userId,
			type: adminNotifications.type,
			title: adminNotifications.title,
			message: adminNotifications.message,
			data: adminNotifications.data,
			isRead: adminNotifications.isRead,
			createdAt: adminNotifications.createdAt,
			user: {
				id: users.id,
				email: users.email,
				username: users.username,
				displayUsername: users.displayUsername,
			},
			// Aggregate counts in the same query using FILTER (WHERE ...)
			totalCount: sql<number>`count(*) OVER()`,
			unreadCount: sql<number>`count(*) FILTER (WHERE ${adminNotifications.isRead} = false) OVER()`,
		})
		.from(adminNotifications)
		.leftJoin(users, eq(adminNotifications.userId, users.id))
		.where(where)
		.orderBy(desc(adminNotifications.createdAt))
		.limit(limit)
		.offset((page - 1) * limit);

	const total = rows.length > 0 ? Number(rows[0]!.totalCount) : 0;
	const unreadCount = rows.length > 0 ? Number(rows[0]!.unreadCount) : 0;

	return {
		notifications: rows.map((r) => ({
			id: r.id,
			userId: r.userId,
			type: r.type,
			title: r.title,
			message: r.message,
			data: r.data,
			isRead: r.isRead,
			createdAt: r.createdAt.toISOString(),
			user: r.user,
		})),
		total,
		unreadCount,
	};
}

export async function markAsRead(notificationId: string, userId: string) {
	await db
		.update(adminNotifications)
		.set({ isRead: true })
		.where(and(eq(adminNotifications.id, notificationId), eq(adminNotifications.userId, userId)));
}

export async function markAllAsRead(userId: string) {
	await db
		.update(adminNotifications)
		.set({ isRead: true })
		.where(and(eq(adminNotifications.userId, userId), eq(adminNotifications.isRead, false)));
}

export type CreateNotificationInput = {
	userId: string;
	type: string;
	title: string;
	message?: string;
	data?: NotificationData;
};

export async function createNotification(data: CreateNotificationInput) {
	await db.insert(adminNotifications).values({
		userId: data.userId,
		type: data.type,
		title: data.title,
		message: data.message ?? null,
		data: data.data ?? null,
	});
}

/**
 * Factory para notificaciones de sync. Tipa `stats: SyncStats` (objeto) para que
 * `JSON.stringify(stats)` sea un error de compilación aquí, no en runtime.
 */
export function buildSyncNotification(input: {
	reportId: string;
	jobId: string | undefined;
	trigger: "manual" | "automatic";
	stats: SyncStats;
	startedAt: string;
	completedAt: string;
}): {
	type: "sync_completed";
	title: string;
	message: string;
	data: SyncNotificationData;
} {
	const { stats, trigger, reportId, jobId, startedAt, completedAt } = input;
	return {
		type: "sync_completed",
		title: "Sincronización completada",
		message: `${stats.processed} procesados | ${stats.created} creados | ${stats.updated} actualizados | ${stats.errors} errores`,
		data: { reportId, jobId, trigger, stats, startedAt, completedAt },
	};
}

/**
 * Factory para notificaciones de pedido nuevo. Encapsula el shape `type + data`
 * para que no se desincronicen.
 */
export function buildOrderNotification(input: {
	orderId: string;
	orderNumber: string;
	total: string;
	customerName: string | null;
}): {
	type: "order:created";
	title: string;
	message: string;
	data: OrderNotificationData;
} {
	const { orderId, orderNumber, total, customerName } = input;
	return {
		type: "order:created",
		title: "Nuevo pedido recibido",
		message: `Pedido ${orderNumber} — S/ ${total}${customerName ? ` — ${customerName}` : ""}`,
		data: { orderId, orderNumber, total, timestamp: new Date().toISOString() },
	};
}

/**
 * Factory para notificaciones de cancelación automática de pedidos.
 */
export function buildOrderCancelledNotification(input: {
	orderId: string;
	orderNumber: string;
	reason: string;
}): {
	type: "order:auto-cancelled";
	title: string;
	message: string;
	data: OrderNotificationData;
} {
	const { orderId, orderNumber, reason } = input;
	return {
		type: "order:auto-cancelled",
		title: "Pedido cancelado automáticamente",
		message: `Pedido ${orderNumber} fue cancelado por no ser confirmado a tiempo.`,
		data: { orderId, orderNumber, reason, timestamp: new Date().toISOString() },
	};
}

/**
 * Crea notificaciones para todos los admins y las transmite vía WebSocket.
 * SSoT — reemplaza el patrón duplicado en orders/service.ts y scraping.worker.ts.
 */
export async function notifyAdminsOfOrder(payload: {
	orderId: string;
	orderNumber: string;
	total: string;
	customerName: string | null;
}): Promise<void> {
	const adminIds = await getAdminIds();
	if (adminIds.length === 0) return;

	const notification = buildOrderNotification(payload);

	for (const adminId of adminIds) {
		try {
			await createNotification({ userId: adminId, ...notification });
		} catch (err) {
			logger.withMetadata({ adminId, err }).error("[Notifications] Failed to notify admin");
		}
	}

	broadcastToAdmins({
		type: notification.type,
		orderId: payload.orderId,
		orderNumber: payload.orderNumber,
		total: payload.total,
		timestamp: notification.data.timestamp ?? new Date().toISOString(),
	});
}

/**
 * Crea notificaciones de cancelación para todos los admins y las transmite vía WebSocket.
 * SSoT — reemplaza el patrón duplicado en orders/service.ts.
 */
export async function notifyAdminsOfCancelledOrder(payload: {
	orderId: string;
	orderNumber: string;
	reason: string;
}): Promise<void> {
	const adminIds = await getAdminIds();
	if (adminIds.length === 0) return;

	const notification = buildOrderCancelledNotification(payload);

	for (const adminId of adminIds) {
		try {
			await createNotification({ userId: adminId, ...notification });
		} catch (err) {
			logger
				.withMetadata({ adminId, err })
				.error("[Notifications] Failed to notify admin about cancellation");
		}
	}

	broadcastToAdmins({
		type: notification.type,
		orderId: payload.orderId,
		orderNumber: payload.orderNumber,
		reason: payload.reason,
		timestamp: notification.data.timestamp ?? new Date().toISOString(),
	});
}
