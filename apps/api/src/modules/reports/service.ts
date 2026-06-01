import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { productChanges, products, syncReports } from "@renovabit/db/schema";
import { desc, eq } from "drizzle-orm";

type ChangeRow = {
	id: string;
	productId: string;
	productName: string;
	productSku: string;
	changeType: string;
	field: string | null;
	oldValue: unknown;
	newValue: unknown;
	reason: string | null;
	createdAt: Date;
};

async function getChangesByReport(reportId: string): Promise<ChangeRow[]> {
	return db
		.select({
			id: productChanges.id,
			productId: productChanges.productId,
			productName: products.name,
			productSku: products.sku,
			changeType: productChanges.changeType,
			field: productChanges.field,
			oldValue: productChanges.oldValue,
			newValue: productChanges.newValue,
			reason: productChanges.reason,
			createdAt: productChanges.createdAt,
		})
		.from(productChanges)
		.innerJoin(products, eq(productChanges.productId, products.id))
		.where(eq(productChanges.syncReportId, reportId))
		.orderBy(desc(productChanges.createdAt));
}

export const ReportsService = {
	getChangesByReport,
};
