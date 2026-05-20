import { productImages } from "@renovabit/db/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import { t, type UnwrapSchema } from "elysia";

// ── Insert / Update ────────────────────────────────

const _insert = createInsertSchema(productImages, {
	productId: t.String({ format: "uuid" }),
	url: t.String({ minLength: 1, maxLength: 2048 }),
	alt: t.Optional(t.String({ maxLength: 255 })),
	sortOrder: t.Optional(t.Integer({ minimum: 0 })),
	isPrimary: t.Optional(t.Boolean()),
});

// ── Response ──

const ProductImageResponse = createSelectSchema(productImages);

// ── Error ──────────────────────────────────────────

export const ErrorResponse = t.Object({
	errId: t.String(),
	code: t.String(),
	message: t.String(),
	statusCode: t.Number(),
});

// ── Export ─────────────────────────────────────────

export const ProductImageModel = {
	// Bodies
	createBody: t.Omit(_insert, ["id", "createdAt", "updatedAt"]),
	updateBody: t.Partial(t.Omit(_insert, ["id", "createdAt", "updatedAt", "productId"])),

	// Params
	idParams: t.Object({ id: t.String({ format: "uuid" }) }),
	productIdParams: t.Object({ productId: t.String({ format: "uuid" }) }),

	// Responses
	imageResponse: ProductImageResponse,
	imageListResponse: t.Array(ProductImageResponse),
} as const;

export type ProductImageModel = {
	[k in keyof typeof ProductImageModel]: UnwrapSchema<(typeof ProductImageModel)[k]>;
};
