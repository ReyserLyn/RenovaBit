import { db } from "@renovabit/db";
import {
	type ChangeValueObject,
	productChanges,
	products,
	type SyncStats,
	syncReports,
} from "@renovabit/db/schema";
import { desc, eq, sql } from "drizzle-orm";

type ChangeRow = {
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
};

type SyncReportRow = {
	id: string;
	jobId: string | null;
	trigger: string;
	status: string;
	stats: SyncStats;
	errorMessage: string | null;
	startedAt: Date;
	completedAt: Date | null;
};

export type SyncReportStatus = "running" | "completed" | "failed";

export type SyncReportStatsSummary = {
	processed: number;
	created: number;
	updated: number;
	unchanged: number;
	errors: number;
	outOfStock: number;
	failedCount: number;
	aiCostUsd: number;
	durationMs: number;
};

export type SyncReportSummary = Omit<SyncReportRow, "stats"> & {
	stats: SyncReportStatsSummary;
};

export type SyncReportDetail = SyncReportRow;

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

/** Projects the rich jsonb stats down to what the list view needs. */
function summarizeStats(stats: SyncStats): SyncReportStatsSummary {
	return {
		processed: stats.processed,
		created: stats.created,
		updated: stats.updated,
		unchanged: stats.unchanged,
		errors: stats.errors,
		outOfStock: stats.outOfStock,
		failedCount: stats.failedItems?.length ?? 0,
		aiCostUsd: stats.ai?.costUsd ?? 0,
		durationMs: stats.durationMs ?? 0,
	};
}

async function listReports(params: {
	page: number;
	limit: number;
	status?: SyncReportStatus;
}): Promise<{ reports: SyncReportSummary[]; total: number }> {
	const where = params.status ? eq(syncReports.status, params.status) : undefined;

	const [countResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(syncReports)
		.where(where);

	const rows = await db
		.select({
			id: syncReports.id,
			jobId: syncReports.jobId,
			trigger: syncReports.trigger,
			status: syncReports.status,
			stats: syncReports.stats,
			errorMessage: syncReports.errorMessage,
			startedAt: syncReports.startedAt,
			completedAt: syncReports.completedAt,
		})
		.from(syncReports)
		.where(where)
		// `id` is a uuidv7: it breaks startedAt ties (and keeps pagination stable).
		.orderBy(desc(syncReports.startedAt), desc(syncReports.id))
		.limit(params.limit)
		.offset((params.page - 1) * params.limit);

	return {
		reports: rows.map((row) => ({ ...row, stats: summarizeStats(row.stats) })),
		total: Number(countResult?.count ?? 0),
	};
}

async function getReportById(reportId: string): Promise<SyncReportDetail | null> {
	const [row] = await db
		.select({
			id: syncReports.id,
			jobId: syncReports.jobId,
			trigger: syncReports.trigger,
			status: syncReports.status,
			stats: syncReports.stats,
			errorMessage: syncReports.errorMessage,
			startedAt: syncReports.startedAt,
			completedAt: syncReports.completedAt,
		})
		.from(syncReports)
		.where(eq(syncReports.id, reportId))
		.limit(1);

	return row ?? null;
}

export const ReportsService = {
	getChangesByReport,
	listReports,
	getReportById,
};
