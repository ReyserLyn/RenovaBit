import { brands } from "@renovabit/db/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import { t, type UnwrapSchema } from "elysia";

// ── Insert / Update ────────────────────────────────

const _insert = createInsertSchema(brands, {
	name: t.String({ minLength: 1, maxLength: 100 }),
	slug: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
	description: t.Optional(t.String({ maxLength: 5000 })),
	imageUrl: t.Optional(t.String({ maxLength: 2048 })),
});

// ── Response ──

const BrandResponse = createSelectSchema(brands);

const BulkDeleteResult = t.Object({
	deletedIds: t.Array(t.String({ format: "uuid" })),
	notFoundIds: t.Array(t.String({ format: "uuid" })),
	deletedCount: t.Integer({ minimum: 0 }),
});

// ── Error ──────────────────────────────────────────

export const ErrorResponse = t.Object({
	errId: t.String(),
	code: t.String(),
	message: t.String(),
	statusCode: t.Number(),
});

// ── Export ─────────────────────────────────────────

export const BrandModel = {
	// Bodies
	createBody: t.Omit(_insert, ["id", "createdAt", "updatedAt"]),
	updateBody: t.Partial(t.Omit(_insert, ["id", "createdAt", "updatedAt"])),

	// Params
	params: t.Object({ slug: t.String({ minLength: 1 }) }),

	// Batch
	bulkDeleteBody: t.Object({
		ids: t.Array(t.String({ format: "uuid" }), { minItems: 1, maxItems: 50 }),
	}),

	// Responses
	brandResponse: BrandResponse,
	brandListResponse: t.Array(BrandResponse),
	bulkDeleteResponse: BulkDeleteResult,
} as const;

export type BrandModel = {
	[k in keyof typeof BrandModel]: UnwrapSchema<(typeof BrandModel)[k]>;
};
