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

export const ReportsModel = {
	changesListResponse: ChangesListResponse,
	reportIdParams: ReportIdParams,
} as const;

export type ReportsModel = {
	[k in keyof typeof ReportsModel]: UnwrapSchema<(typeof ReportsModel)[k]>;
};
