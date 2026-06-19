import { Elysia, t } from "elysia";
import { AuthModule } from "@/modules/auth";
import { ErrorResponse } from "@/modules/orders/model";
import { NotificationModel } from "./notifications.model";
import { getNotifications, markAllAsRead, markAsRead } from "./notifications.service";

const OkResponse = t.Object({ ok: t.Boolean() });
const IdParams = t.Object({ id: t.String({ format: "uuid" }) });

export const notificationsRoute = new Elysia({ prefix: "/notifications" })
	.use(AuthModule)
	.get(
		"/",
		async ({ query, user }) => {
			const userId = user.id;
			const page = Number.parseInt(query.page ?? "1", 10) || 1;
			const limit = Number.parseInt(query.limit ?? "20", 10) || 20;
			const unreadOnly = query.unreadOnly === "true";
			const search = query.search || undefined;

			return getNotifications(userId, page, limit, unreadOnly, search);
		},
		{
			isAdmin: true,
			query: NotificationModel.listQuery,
			response: {
				200: NotificationModel.listResponse,
				401: ErrorResponse,
				403: ErrorResponse,
			},
			detail: { summary: "Listar notificaciones", tags: ["Notifications"] },
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
			params: IdParams,
			response: {
				200: OkResponse,
				401: ErrorResponse,
				403: ErrorResponse,
			},
			detail: { summary: "Marcar notificación como leída", tags: ["Notifications"] },
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
			response: {
				200: OkResponse,
				401: ErrorResponse,
				403: ErrorResponse,
			},
			detail: { summary: "Marcar todas como leídas", tags: ["Notifications"] },
		},
	);
