import { t } from "elysia";

export const NotificationModel = {
	listQuery: t.Object({
		page: t.Optional(t.String()),
		limit: t.Optional(t.String()),
		unreadOnly: t.Optional(t.String()),
	}),
	listResponse: t.Object({
		notifications: t.Array(t.Any()),
		total: t.Integer(),
		unreadCount: t.Integer(),
	}),
};
