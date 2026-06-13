import { db } from "@renovabit/db";
import { adminNotifications, users } from "@renovabit/db/schema";
import { and, desc, eq, or, sql } from "drizzle-orm";

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
	const where = and(
		eq(adminNotifications.userId, userId),
		...(unreadOnly ? [eq(adminNotifications.isRead, false)] : []),
		...(search
			? [
					or(
						sql`${adminNotifications.id}::text ILIKE ${`%${search}%`}`,
						sql`${adminNotifications.title} ILIKE ${`%${search}%`}`,
						sql`${adminNotifications.message} ILIKE ${`%${search}%`}`,
						sql`${adminNotifications.data}->>'jobId' ILIKE ${`%${search}%`}`,
						sql`${adminNotifications.data}->>'reportId' ILIKE ${`%${search}%`}`,
						sql`${adminNotifications.data}->>'orderId' ILIKE ${`%${search}%`}`,
						sql`${adminNotifications.data}->>'orderNumber' ILIKE ${`%${search}%`}`,
					),
				]
			: []),
	);

	const [result] = await db
		.select({ count: sql<number>`count(*)` })
		.from(adminNotifications)
		.where(where);

	const [unreadResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(adminNotifications)
		.where(and(eq(adminNotifications.userId, userId), eq(adminNotifications.isRead, false)));

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
		})
		.from(adminNotifications)
		.leftJoin(users, eq(adminNotifications.userId, users.id))
		.where(where)
		.orderBy(desc(adminNotifications.createdAt))
		.limit(limit)
		.offset((page - 1) * limit);

	return {
		notifications: rows.map((r) => ({
			...r,
			createdAt: r.createdAt.toISOString(),
		})),
		total: Number(result?.count ?? 0),
		unreadCount: Number(unreadResult?.count ?? 0),
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

export async function createNotification(data: {
	userId: string;
	type: string;
	title: string;
	message?: string;
	data?: Record<string, unknown>;
}) {
	await db.insert(adminNotifications).values({
		userId: data.userId,
		type: data.type,
		title: data.title,
		message: data.message ?? null,
		data: data.data ?? null,
	});
}
