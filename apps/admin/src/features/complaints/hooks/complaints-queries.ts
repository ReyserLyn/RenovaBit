import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import type { ComplaintStatus } from "../model";
import { complaintsService } from "../service/complaints.service";

// ── Query Key Factory ──────────────────────────────────

export interface ComplaintListParams {
	page: number;
	pageSize: number;
	status?: ComplaintStatus;
	search?: string;
}

export const complaintKeys = {
	all: ["complaints"] as const,
	lists: () => [...complaintKeys.all, "list"] as const,
	paginated: (params: ComplaintListParams) =>
		[...complaintKeys.lists(), "paginated", params] as const,
	details: () => [...complaintKeys.all, "detail"] as const,
	detail: (id: string) => [...complaintKeys.details(), id] as const,
};

// ── Query Options — Table (server-side pagination) ─────

export function complaintsPaginatedQueryOptions(params: ComplaintListParams) {
	return queryOptions({
		queryKey: complaintKeys.paginated(params),
		queryFn: () =>
			complaintsService.list({
				page: String(params.page),
				limit: String(params.pageSize),
				...(params.status ? { status: params.status } : {}),
				...(params.search ? { search: params.search } : {}),
			}),
		placeholderData: keepPreviousData,
		staleTime: 30_000,
	});
}

// ── Queries ────────────────────────────────────────────

export function usePaginatedComplaints(params: ComplaintListParams) {
	return useQuery(complaintsPaginatedQueryOptions(params));
}

export function complaintQueryOptions(id: string) {
	return queryOptions({
		queryKey: complaintKeys.detail(id),
		queryFn: () => complaintsService.getById(id),
		enabled: id.length > 0,
	});
}

export function useComplaint(id: string) {
	return useQuery(complaintQueryOptions(id));
}
