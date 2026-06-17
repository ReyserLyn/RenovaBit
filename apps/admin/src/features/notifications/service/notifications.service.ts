import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";
import type { AppNotification } from "../model";

async function list(params: {
	page?: number;
	limit?: number;
	unreadOnly?: boolean;
	search?: string;
}): Promise<{
	notifications: AppNotification[];
	total: number;
	unreadCount: number;
}> {
	const query: Record<string, string> = {};
	if (params.page) query.page = String(params.page);
	if (params.limit) query.limit = String(params.limit);
	if (params.unreadOnly) query.unreadOnly = "true";
	if (params.search) query.search = params.search;

	return unwrapResponse(api.api.v1.admin.notifications.get({ query }));
}

async function markAsRead(id: string): Promise<void> {
	await unwrapResponse(api.api.v1.admin.notifications({ id }).read.patch());
}

async function markAllAsRead(): Promise<void> {
	await unwrapResponse(api.api.v1.admin.notifications["read-all"].post());
}

export const notificationsService = {
	list,
	markAsRead,
	markAllAsRead,
};
