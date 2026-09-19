import { t, type UnwrapSchema } from "elysia";

const ChangeValueObjectSchema = t.Record(
	t.String(),
	t.Union([t.String(), t.Number(), t.Boolean(), t.Null()]),
);

const ChangeResponse = t.Object({
	id: t.String({ format: "uuid" }),
	productId: t.String({ format: "uuid" }),
	productName: t.String(),
	productSku: t.String(),
	changeType: t.String(),
	field: t.Nullable(t.String()),
	oldValue: t.Nullable(ChangeValueObjectSchema),
	newValue: t.Nullable(ChangeValueObjectSchema),
	reason: t.Nullable(t.String()),
	createdAt: t.String(),
});

const ChangesListResponse = t.Object({
	changes: t.Array(ChangeResponse),
	total: t.Integer({ minimum: 0 }),
});

const ReportIdParams = t.Object({
	reportId: t.String({ format: "uuid" }),
});

// ── Sync reports ───────────────────────────────────

const ListQuery = t.Object({
	page: t.Optional(t.String()),
	limit: t.Optional(t.String()),
	status: t.Optional(t.Union([t.Literal("running"), t.Literal("completed"), t.Literal("failed")])),
});

const SyncStatsSummary = t.Object({
	processed: t.Integer(),
	created: t.Integer(),
	updated: t.Integer(),
	unchanged: t.Integer(),
	errors: t.Integer(),
	outOfStock: t.Integer(),
	/** `stats.failedItems.length`, projected to keep the list payload small. */
	failedCount: t.Integer(),
	aiCostUsd: t.Number(),
	durationMs: t.Number(),
});

const SyncStatsSchema = t.Object({
	processed: t.Integer(),
	created: t.Integer(),
	updated: t.Integer(),
	unchanged: t.Integer(),
	errors: t.Integer(),
	outOfStock: t.Integer(),
	failedItems: t.Optional(t.Array(t.Object({ providerId: t.String(), reason: t.String() }))),
	ai: t.Optional(
		t.Object({
			calls: t.Integer(),
			failed: t.Integer(),
			inputTokens: t.Integer(),
			outputTokens: t.Integer(),
			costUsd: t.Number(),
		}),
	),
	images: t.Optional(
		t.Object({ checked: t.Integer(), processed: t.Integer(), missing: t.Integer() }),
	),
	unavailableMarked: t.Optional(t.Integer()),
	zeroingSkipped: t.Optional(t.Boolean()),
	blacklistedRemoved: t.Optional(t.Integer()),
	durationMs: t.Optional(t.Number()),
});

const SyncReportBase = {
	id: t.String({ format: "uuid" }),
	jobId: t.Nullable(t.String()),
	trigger: t.String(),
	status: t.String(),
	startedAt: t.String(),
	completedAt: t.Nullable(t.String()),
	errorMessage: t.Nullable(t.String()),
};

const SyncReportSummary = t.Object({
	...SyncReportBase,
	stats: SyncStatsSummary,
});

const SyncReportDetail = t.Object({
	...SyncReportBase,
	stats: SyncStatsSchema,
});

const ReportsListResponse = t.Object({
	reports: t.Array(SyncReportSummary),
	total: t.Integer({ minimum: 0 }),
});

export const ReportsModel = {
	changesListResponse: ChangesListResponse,
	reportIdParams: ReportIdParams,
	listQuery: ListQuery,
	listResponse: ReportsListResponse,
	detailResponse: SyncReportDetail,
} as const;

export type ReportsModel = {
	[k in keyof typeof ReportsModel]: UnwrapSchema<(typeof ReportsModel)[k]>;
};
