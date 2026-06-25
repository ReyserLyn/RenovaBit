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

/** Flag de normalización (no es columna, solo controla el upload). */
const NormalizeFlag = t.Object({
	normalize: t.Optional(t.Boolean({ default: true })),
});

// ── Admin Responses ───────────────────────────────

const AdminBrandResponse = createSelectSchema(brands);

const BulkDeleteResult = t.Object({
	deletedIds: t.Array(t.String({ format: "uuid" })),
	notFoundIds: t.Array(t.String({ format: "uuid" })),
	deletedCount: t.Integer({ minimum: 0 }),
});

// ── Public Responses ───────────────────

export const PublicBrandListItem = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	imageUrl: t.Nullable(t.String()),
	productCount: t.Integer({ minimum: 0 }),
});

export const PublicBrandDetail = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	description: t.Nullable(t.String()),
	imageUrl: t.Nullable(t.String()),
	productCount: t.Integer({ minimum: 0 }),
});

// ── Tipos derivados de schemas (SSOT — sin duplicar en service) ──

export type PublicBrandListItem = typeof PublicBrandListItem.static;
export type PublicBrandDetail = typeof PublicBrandDetail.static;

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
	createBody: t.Composite([t.Omit(_insert, ["id", "createdAt", "updatedAt"]), NormalizeFlag]),
	updateBody: t.Composite([
		t.Partial(t.Omit(_insert, ["id", "createdAt", "updatedAt"])),
		NormalizeFlag,
	]),

	// Params
	slugParams: t.Object({ slug: t.String({ minLength: 1 }) }),
	idParams: t.Object({ id: t.String({ format: "uuid" }) }),

	// Batch
	bulkDeleteBody: t.Object({
		ids: t.Array(t.String({ format: "uuid" }), { minItems: 1, maxItems: 50 }),
	}),

	// Query
	listQuery: t.Object({
		categorySlug: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
		q: t.Optional(t.String({ minLength: 2, maxLength: 100 })),
	}),

	// Admin Responses
	brandResponse: AdminBrandResponse,
	brandListResponse: t.Array(AdminBrandResponse),
	bulkDeleteResponse: BulkDeleteResult,

	// Public Responses
	publicBrandListItem: PublicBrandListItem,
	publicBrandListResponse: t.Array(PublicBrandListItem),
	publicBrandDetail: PublicBrandDetail,
} as const;

export type BrandModel = {
	[k in keyof typeof BrandModel]: UnwrapSchema<(typeof BrandModel)[k]>;
};
