import { categories } from "@renovabit/db/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import { t, type UnwrapSchema } from "elysia";

// ── Insert / Update ────────────────────────────────

const _insert = createInsertSchema(categories, {
	name: t.String({ minLength: 1, maxLength: 255 }),
	slug: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
	description: t.Optional(t.String({ maxLength: 5000 })),
	imageUrl: t.Optional(t.String({ maxLength: 2048 })),
	parentId: t.Optional(t.Union([t.String({ format: "uuid" }), t.Null()])),
	path: t.Optional(t.String()),
	sortOrder: t.Optional(t.Integer({ minimum: 0 })),
	isFeatured: t.Optional(t.Boolean()),
	isActive: t.Optional(t.Boolean()),
	isVisibleInNav: t.Optional(t.Boolean()),
});

// ── Admin Responses ────────────────────────────────

const AdminCategoryResponse = createSelectSchema(categories);

const AdminCategoryTreeNodeSchema = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	imageUrl: t.Union([t.String(), t.Null()]),
	description: t.Union([t.String(), t.Null()]),
	sortOrder: t.Union([t.Integer(), t.Null()]),
	isFeatured: t.Boolean(),
	isActive: t.Boolean(),
	isVisibleInNav: t.Boolean(),
	children: t.Array(t.Unknown()),
});

const BreadcrumbItem = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
});

const BulkDeleteResult = t.Object({
	deletedIds: t.Array(t.String({ format: "uuid" })),
	notFoundIds: t.Array(t.String({ format: "uuid" })),
	deletedCount: t.Integer({ minimum: 0 }),
});

// ── Public Responses (sin fugas) ───────────────────

const PublicCategoryTreeNodeSchema = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	imageUrl: t.Nullable(t.String()),
	description: t.Nullable(t.String()),
	productCount: t.Integer({ minimum: 0 }),
	children: t.Array(t.Unknown()),
});

export const PublicCategoryDetail = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	description: t.Nullable(t.String()),
	imageUrl: t.Nullable(t.String()),
	isFeatured: t.Boolean(),
	breadcrumb: t.Array(BreadcrumbItem),
	productCount: t.Integer({ minimum: 0 }),
});

// ── Tipos derivados de schemas ──

export type PublicCategoryDetail = typeof PublicCategoryDetail.static;
export type BreadcrumbItem = typeof BreadcrumbItem.static;
export type BulkDeleteResult = typeof BulkDeleteResult.static;

// ── Tipos recursivos (workaround de t.Unknown()) ──

export interface AdminCategoryTree {
	id: string;
	name: string;
	slug: string;
	imageUrl: string | null;
	description: string | null;
	sortOrder: number | null;
	isFeatured: boolean;
	isActive: boolean;
	isVisibleInNav: boolean;
	children: AdminCategoryTree[];
}

export interface PublicCategoryTree {
	id: string;
	name: string;
	slug: string;
	imageUrl: string | null;
	description: string | null;
	productCount: number;
	children: PublicCategoryTree[];
}

// ── Error ──────────────────────────────────────────

export const ErrorResponse = t.Object({
	errId: t.String(),
	code: t.String(),
	message: t.String(),
	statusCode: t.Number(),
});

// ── Export ─────────────────────────────────────────

export const CategoryModel = {
	// Bodies
	createBody: t.Omit(_insert, ["id", "createdAt", "updatedAt", "path"]),
	updateBody: t.Partial(t.Omit(_insert, ["id", "createdAt", "updatedAt", "path"])),

	// Params
	idParams: t.Object({ id: t.String({ format: "uuid" }) }),
	slugParams: t.Object({ slug: t.String({ minLength: 1 }) }),

	// Query
	listQuery: t.Object({
		includeInactive: t.Optional(t.Boolean()),
		isFeatured: t.Optional(t.Boolean()),
		parentId: t.Optional(t.String({ format: "uuid" })),
		isVisibleInNav: t.Optional(t.Boolean()),
	}),
	treeQuery: t.Object({
		includeInactive: t.Optional(t.Boolean()),
	}),

	// Batch
	bulkDeleteBody: t.Object({
		ids: t.Array(t.String({ format: "uuid" }), { minItems: 1, maxItems: 50 }),
	}),

	// Admin Responses
	categoryResponse: AdminCategoryResponse,
	categoryListResponse: t.Array(AdminCategoryResponse),
	categoryTreeResponse: t.Array(AdminCategoryTreeNodeSchema),
	bulkDeleteResponse: BulkDeleteResult,

	// Public Responses
	publicCategoryTreeResponse: t.Array(PublicCategoryTreeNodeSchema),
	publicCategoryDetail: PublicCategoryDetail,
} as const;

export type CategoryModel = {
	[k in keyof typeof CategoryModel]: UnwrapSchema<(typeof CategoryModel)[k]>;
};
