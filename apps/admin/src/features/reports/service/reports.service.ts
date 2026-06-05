import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";
import type { RecentChange, ReportChange } from "../model";

async function getChanges(reportId: string): Promise<{ changes: ReportChange[]; total: number }> {
	return unwrapResponse(api.api.v1.admin.reports({ reportId }).changes.get());
}

async function listRecent(params?: {
	page?: number;
	limit?: number;
	type?: string;
	search?: string;
}): Promise<{ changes: RecentChange[]; total: number }> {
	const query: Record<string, string> = {};
	if (params?.page) query.page = String(params.page);
	if (params?.limit) query.limit = String(params.limit);
	if (params?.type) query.type = params.type;
	if (params?.search) query.search = params.search;

	return unwrapResponse(api.api.v1.admin.changes.get({ query }));
}

export const reportsService = {
	getChanges,
	listRecent,
};
