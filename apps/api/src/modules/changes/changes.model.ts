import { t } from "elysia";

const RecentChangeItemSchema = t.Object({
	id: t.String({ format: "uuid" }),
	productId: t.String({ format: "uuid" }),
	productName: t.String(),
	productSku: t.String(),
	syncReportId: t.Nullable(t.String({ format: "uuid" })),
	reportTrigger: t.Nullable(t.String()),
	reportStartedAt: t.Nullable(t.String()),
	changeType: t.String(),
	field: t.Nullable(t.String()),
	oldValue: t.Unknown(),
	newValue: t.Unknown(),
	reason: t.Nullable(t.String()),
	source: t.String(),
	createdAt: t.String(),
});

export const ChangesModel = {
	listQuery: t.Object({
		page: t.Optional(t.String()),
		limit: t.Optional(t.String()),
		type: t.Optional(t.String()),
		search: t.Optional(t.String()),
	}),
	listResponse: t.Object({
		changes: t.Array(RecentChangeItemSchema),
		total: t.Integer(),
	}),
} as const;
