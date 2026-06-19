import { t } from "elysia";

const PrimitiveValue = t.Union([t.String(), t.Number(), t.Boolean(), t.Null()]);

const NotificationDataSchema = t.Record(
	t.String(),
	t.Union([PrimitiveValue, t.Record(t.String(), PrimitiveValue)]),
);

export const notificationItemSchema = t.Object({
	id: t.String(),
	userId: t.String(),
	type: t.String(),
	title: t.String(),
	message: t.Nullable(t.String()),
	data: t.Nullable(NotificationDataSchema),
	isRead: t.Boolean(),
	createdAt: t.String(),
	user: t.Nullable(
		t.Object({
			id: t.String(),
			email: t.String(),
			username: t.Nullable(t.String()),
			displayUsername: t.Nullable(t.String()),
		}),
	),
});

export const NotificationModel = {
	listQuery: t.Object({
		page: t.Optional(t.String()),
		limit: t.Optional(t.String()),
		unreadOnly: t.Optional(t.String()),
		search: t.Optional(t.String()),
	}),
	listResponse: t.Object({
		notifications: t.Array(notificationItemSchema),
		total: t.Integer(),
		unreadCount: t.Integer(),
	}),
};
