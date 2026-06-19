import type { ChangeValueObject } from "@renovabit/db/schema";
import { Elysia } from "elysia";
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

export const reportsRoute = new Elysia({ prefix: "/reports" }).get(
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
