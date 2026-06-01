import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";

export interface ReportChange {
	id: string;
	productId: string;
	productName: string;
	productSku: string;
	changeType: string;
	field: string | null;
	oldValue: unknown;
	newValue: unknown;
	reason: string | null;
	createdAt: string;
}

export interface ProductChange {
	id: string;
	syncReportId: string | null;
	reportTrigger: string | null;
	reportStartedAt: string | null;
	changeType: string;
	field: string | null;
	oldValue: unknown;
	newValue: unknown;
	reason: string | null;
	source: string;
	createdAt: string;
}

/** Cambio con información del producto (feed global) */
export interface RecentChange {
	id: string;
	productId: string;
	productName: string;
	productSku: string;
	syncReportId: string | null;
	reportTrigger: string | null;
	reportStartedAt: string | null;
	changeType: string;
	field: string | null;
	oldValue: unknown;
	newValue: unknown;
	reason: string | null;
	source: string;
	createdAt: string;
}

async function getChanges(reportId: string): Promise<{ changes: ReportChange[]; total: number }> {
	return unwrapResponse(api.api.v1.reports({ reportId }).changes.get());
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

	return unwrapResponse(api.api.v1.changes.get({ query }));
}

export const reportsService = {
	getChanges,
	listRecent,
};
