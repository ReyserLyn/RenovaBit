import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";
import type { ComplaintDetail, ComplaintListResponse, ComplaintStatus } from "../model";

// ── Body types derived from Eden Treaty (SSOT with the API) ──

export type RespondComplaintValues = Parameters<
	ReturnType<typeof api.api.v1.admin.complaints>["patch"]
>[0];

// ── Query types ──

export interface ComplaintListQuery {
	status?: ComplaintStatus;
	search?: string;
	page?: string;
	limit?: string;
}

// ── API Functions ────────────────────────────────────

async function list(options: ComplaintListQuery = {}): Promise<ComplaintListResponse> {
	const query: Record<string, string> = {};
	if (options.status) query.status = options.status;
	if (options.search) query.search = options.search;
	if (options.page) query.page = options.page;
	if (options.limit) query.limit = options.limit;

	return unwrapResponse(api.api.v1.admin.complaints.get({ query }));
}

async function getById(id: string): Promise<ComplaintDetail> {
	return unwrapResponse(api.api.v1.admin.complaints({ id }).get());
}

async function respond(id: string, data: RespondComplaintValues): Promise<ComplaintDetail> {
	return unwrapResponse(api.api.v1.admin.complaints({ id }).patch(data));
}

// ── Public API ──────────────────────────────────────

export const complaintsService = {
	list,
	getById,
	respond,
};
