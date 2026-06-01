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

async function getChanges(reportId: string): Promise<{ changes: ReportChange[]; total: number }> {
	return unwrapResponse(api.api.v1.reports({ reportId }).changes.get());
}

export const reportsService = {
	getChanges,
};
