import { t, type UnwrapSchema } from "elysia";

export const SyncResultSchema = t.Object({
	success: t.Boolean(),
	reportId: t.String(),
	stats: t.Object({
		processed: t.Integer(),
		created: t.Integer(),
		updated: t.Integer(),
		unchanged: t.Integer(),
		errors: t.Integer(),
		outOfStock: t.Integer(),
	}),
});

export const SyncModel = {
	result: SyncResultSchema,
} as const;

export type SyncModel = {
	[k in keyof typeof SyncModel]: UnwrapSchema<(typeof SyncModel)[k]>;
};

export type SyncStats = {
	processed: number;
	created: number;
	updated: number;
	unchanged: number;
	errors: number;
	outOfStock: number;
};
