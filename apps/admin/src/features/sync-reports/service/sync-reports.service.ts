import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";
import type { SyncReportDetail, SyncReportStatus, SyncReportSummary } from "../model";

async function list(params?: {
	page?: number;
	limit?: number;
	status?: SyncReportStatus;
}): Promise<{ reports: SyncReportSummary[]; total: number }> {
	const query: { page?: string; limit?: string; status?: SyncReportStatus } = {};
	if (params?.page) query.page = String(params.page);
	if (params?.limit) query.limit = String(params.limit);
	if (params?.status) query.status = params.status;

	return unwrapResponse(api.api.v1.admin.reports.get({ query }));
}

async function getById(reportId: string): Promise<SyncReportDetail> {
	return unwrapResponse(api.api.v1.admin.reports({ reportId }).get());
}

async function run(limit = 2000): Promise<{ success: boolean; jobId: string; message: string }> {
	return unwrapResponse(
		api.api.v1.admin.scraping.run.post(undefined, { query: { limit: String(limit) } }),
	);
}

export const syncReportsService = {
	list,
	getById,
	run,
};
