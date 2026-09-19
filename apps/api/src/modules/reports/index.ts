import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import type { ChangeValueObject } from "@renovabit/db/schema";
import { Elysia } from "elysia";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/constants";
import { AuthMacros } from "@/modules/auth";
import { ErrorResponse } from "@/modules/products/model";
import { ReportsModel } from "./model";
import { ReportsService } from "./service";

function serializeChange(row: {
	id: string;
	productId: string;
	productName: string;
	productSku: string;
	changeType: string;
	field: string | null;
	oldValue: ChangeValueObject | null;
	newValue: ChangeValueObject | null;
	reason: string | null;
	createdAt: Date;
}) {
	return {
		...row,
		createdAt: row.createdAt.toISOString(),
	};
}

/** DB timestamps leave the API as ISO strings, like the changes route does. */
function serializeReport<T extends { startedAt: Date; completedAt: Date | null }>(report: T) {
	return {
		...report,
		startedAt: report.startedAt.toISOString(),
		completedAt: report.completedAt?.toISOString() ?? null,
	};
}

export const reportsRoute = new Elysia({ prefix: "/reports" })
	.use(AuthMacros)
	.get(
		"/",
		async ({ query }) => {
			// Unbounded values used to reach Postgres as a negative OFFSET or as a
			// full-table page — same clamp as the notifications module.
			const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
			const limit = Math.min(
				MAX_PAGE_SIZE,
				Math.max(
					1,
					Number.parseInt(query.limit ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE,
				),
			);

			const { reports, total } = await ReportsService.listReports({
				page,
				limit,
				status: query.status,
			});

			return { reports: reports.map(serializeReport), total };
		},
		{
			isAdmin: true,
			query: ReportsModel.listQuery,
			response: {
				200: ReportsModel.listResponse,
				401: ErrorResponse,
				403: ErrorResponse,
			},
			detail: { summary: "Listar reportes de sincronización", tags: ["Reports"] },
		},
	)
	.get(
		"/:reportId",
		async ({ params: { reportId } }) => {
			const report = await ReportsService.getReportById(reportId);

			if (!report) {
				throw createApiError({
					code: BackendErrorCodes.NOT_FOUND_ERROR,
					message: "Reporte de sincronización no encontrado",
					logLevel: "info",
					doNotLog: true,
				});
			}

			return serializeReport(report);
		},
		{
			isAdmin: true,
			params: ReportsModel.reportIdParams,
			response: {
				200: ReportsModel.detailResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Detalle de un reporte de sincronización", tags: ["Reports"] },
		},
	)
	.get(
		"/:reportId/changes",
		async ({ params: { reportId } }) => {
			const changes = await ReportsService.getChangesByReport(reportId);
			return {
				changes: changes.map(serializeChange),
				total: changes.length,
			};
		},
		{
			isAdmin: true,
			params: ReportsModel.reportIdParams,
			response: {
				200: ReportsModel.changesListResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Listar cambios de un reporte", tags: ["Reports"] },
		},
	);
