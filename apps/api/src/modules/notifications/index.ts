import { Elysia } from "elysia";
import { AuthModule } from "@/modules/auth";
import { NotificationModel } from "./notifications.model";
import { getNotifications, markAllAsRead, markAsRead } from "./notifications.service";

export const notificationsRoute = new Elysia({ prefix: "/notifications" })
	.use(AuthModule)
	.get(
		"/",
		async ({ query, user }) => {
			const userId = user.id;
			const page = Number.parseInt(query.page ?? "1", 10) || 1;
			const limit = Number.parseInt(query.limit ?? "20", 10) || 20;
			const unreadOnly = query.unreadOnly === "true";

			return getNotifications(userId, page, limit, unreadOnly);
		},
		{
			isAdmin: true,
			query: NotificationModel.listQuery,
			response: { 200: NotificationModel.listResponse },
			detail: { summary: "Listar notificaciones", tags: ["Admin"] },
		},
	)
	.patch(
		"/:id/read",
		async ({ params, user }) => {
			await markAsRead(params.id, user.id);
			return { ok: true };
		},
		{
			isAdmin: true,
			detail: { summary: "Marcar notificación como leída", tags: ["Admin"] },
		},
	)
	.post(
		"/read-all",
		async ({ user }) => {
			await markAllAsRead(user.id);
			return { ok: true };
		},
		{
			isAdmin: true,
			detail: { summary: "Marcar todas como leídas", tags: ["Admin"] },
		},
	);
