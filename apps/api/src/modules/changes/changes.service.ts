import { db } from "@renovabit/db";
import { productChanges, products } from "@renovabit/db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

export type GetRecentChangesParams = {
	page?: number;
	limit?: number;
	type?: string;
	search?: string;
};

export async function getRecentChanges(params: GetRecentChangesParams = {}) {
	const { page = 1, limit = 15, type, search } = params;

	const conditions = [
		...(type && type !== "all" ? [eq(productChanges.changeType, type)] : []),
		...(search
			? [or(ilike(products.name, `%${search}%`), ilike(products.sku, `%${search}%`))]
			: []),
	];
	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const [countResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(productChanges)
		.innerJoin(products, eq(productChanges.productId, products.id))
		.where(where);

	const rows = await db
		.select({
			id: productChanges.id,
			productId: productChanges.productId,
			productName: products.name,
			productSku: products.sku,
			syncReportId: productChanges.syncReportId,
			reportTrigger: syncReports.trigger,
			reportStartedAt: syncReports.startedAt,
			changeType: productChanges.changeType,
			field: productChanges.field,
			oldValue: productChanges.oldValue,
			newValue: productChanges.newValue,
			reason: productChanges.reason,
			source: productChanges.source,
			createdAt: productChanges.createdAt,
		})
		.from(productChanges)
		.innerJoin(products, eq(productChanges.productId, products.id))
		.leftJoin(syncReports, eq(productChanges.syncReportId, syncReports.id))
		.where(where)
		.orderBy(desc(productChanges.createdAt))
		.limit(limit)
		.offset((page - 1) * limit);

	return {
		changes: rows,
		total: Number(countResult?.count ?? 0),
	};
}
