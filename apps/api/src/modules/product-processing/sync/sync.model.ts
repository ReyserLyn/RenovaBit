import type { SyncStats } from "@renovabit/db/schema";
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
		durationMs: t.Optional(t.Number()),
	}),
});

export const SyncModel = {
	result: SyncResultSchema,
} as const;

export type SyncModel = {
	[k in keyof typeof SyncModel]: UnwrapSchema<(typeof SyncModel)[k]>;
};

/** Single source of truth for the run stats shape (defined next to the DB column). */
export type { SyncStats };
