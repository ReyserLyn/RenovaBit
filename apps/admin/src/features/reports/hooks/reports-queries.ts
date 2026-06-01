import { queryOptions, useQuery } from "@tanstack/react-query";
import { reportsService } from "../service/reports.service";

export const reportKeys = {
	all: ["reports"] as const,
	changes: (id: string) => [...reportKeys.all, "changes", id] as const,
};

export const reportChangesQueryOptions = (reportId: string) =>
	queryOptions({
		queryKey: reportKeys.changes(reportId),
		queryFn: () => reportsService.getChanges(reportId),
		enabled: reportId.length > 0,
	});

export function useReportChanges(reportId: string) {
	return useQuery(reportChangesQueryOptions(reportId));
}
