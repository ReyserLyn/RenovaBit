import { products } from "@renovabit/db/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import { t, type UnwrapSchema } from "elysia";

// ── Insert / Update ────────────────────────────────

const _insert = createInsertSchema(products, {
	name: t.String({ minLength: 1, maxLength: 255 }),
	slug: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
	description: t.Optional(t.Nullable(t.String({ maxLength: 10000 }))),
	sku: t.String({ minLength: 1, maxLength: 100 }),
	price: t.String({ minLength: 1 }),
	stock: t.Optional(t.Integer({ minimum: 0 })),
	brandId: t.Optional(t.Nullable(t.String({ format: "uuid" }))),
	categoryId: t.Optional(t.Nullable(t.String({ format: "uuid" }))),
	status: t.Optional(t.UnionEnum(["active", "inactive"])),
	isFeatured: t.Optional(t.Boolean()),
});

// ── Response: createSelectSchema garantiza compatibilidad exacta con Drizzle ──

const ProductResponse = createSelectSchema(products);

// List response incluye URLs de imágenes para mostrar en la tabla
const ProductListResponse = t.Composite([
	ProductResponse,
	t.Object({
		imageUrls: t.Array(t.String()),
		imageCount: t.Integer({ minimum: 0 }),
	}),
]);

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

export const ProductModel = {
	// Bodies
	createBody: t.Omit(_insert, ["id", "createdAt", "updatedAt"]),
	updateBody: t.Partial(t.Omit(_insert, ["id", "createdAt", "updatedAt"])),

	// Params
	idParams: t.Object({ id: t.String({ format: "uuid" }) }),
	slugParams: t.Object({ slug: t.String({ minLength: 1 }) }),

	// Query
	listQuery: t.Object({
		brandId: t.Optional(t.String({ format: "uuid" })),
		categoryId: t.Optional(t.String({ format: "uuid" })),
		isFeatured: t.Optional(t.Boolean()),
	}),

	// Batch
	bulkDeleteBody: t.Object({
		ids: t.Array(t.String({ format: "uuid" }), { minItems: 1, maxItems: 50 }),
	}),

	// Responses
	productResponse: ProductResponse,
	productListResponse: t.Array(ProductListResponse),
	bulkDeleteResponse: BulkDeleteResult,
} as const;

export type ProductModel = {
	[k in keyof typeof ProductModel]: UnwrapSchema<(typeof ProductModel)[k]>;
};
