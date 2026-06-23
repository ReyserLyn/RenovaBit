import { t, type UnwrapSchema } from "elysia";

// ── Response Types ────────────────────────────

const FavoriteItemResponse = t.Object({
	id: t.String({ format: "uuid" }),
	productId: t.String({ format: "uuid" }),
	productName: t.String(),
	productSlug: t.String(),
	productSku: t.String(),
	/** Role-aware sale price (customer tier, distributor tier, or admin raw cost). */
	basePrice: t.String(),
	/** Role-aware offer price (null when no offer applies, or for admin). */
	offerPrice: t.Nullable(t.String()),
	/** Discount percent (0–100), present only when an offer applies for the role. */
	discountPercent: t.Nullable(t.Integer({ minimum: 0, maximum: 100 })),
	isFeatured: t.Boolean(),
	stock: t.Integer({ minimum: 0 }),
	isInStock: t.Boolean(),
	primaryImage: t.Nullable(
		t.Object({
			url: t.String(),
			alt: t.Nullable(t.String()),
		}),
	),
	brand: t.Nullable(
		t.Object({
			id: t.String(),
			name: t.String(),
			slug: t.String(),
		}),
	),
	category: t.Nullable(
		t.Object({
			id: t.String(),
			name: t.String(),
			slug: t.String(),
		}),
	),
	createdAt: t.String(),
});

const FavoriteListResponse = t.Object({
	data: t.Array(FavoriteItemResponse),
	total: t.Integer({ minimum: 0 }),
	offset: t.Integer({ minimum: 0 }),
	limit: t.Integer({ minimum: 1 }),
	hasMore: t.Boolean(),
	brands: t.Array(
		t.Object({
			id: t.String(),
			name: t.String(),
			slug: t.String(),
			productCount: t.Integer({ minimum: 0 }),
		}),
	),
});

const FavoriteResponse = t.Object({
	id: t.String({ format: "uuid" }),
	itemsCount: t.Integer({ minimum: 0 }),
	lastActivityAt: t.String(),
});

// ── Bodies ────────────────────────────────────

const AddItemBody = t.Object({
	productId: t.String({ format: "uuid" }),
});

// ── Params ────────────────────────────────────

const ProductIdParams = t.Object({
	productId: t.String({ format: "uuid" }),
});

// ── Query ─────────────────────────────────────

const FavoritesListQuery = t.Object({
	offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 20 })),
	sortBy: t.Optional(t.String()),
	brands: t.Optional(t.String()),
	minPrice: t.Optional(t.String()),
	maxPrice: t.Optional(t.String()),
});

const FavoriteStatusBatchQuery = t.Object({
	productIds: t.Array(t.String({ format: "uuid" }), { minItems: 1, maxItems: 200 }),
});

// ── Error ─────────────────────────────────────

export const ErrorResponse = t.Object({
	errId: t.String(),
	code: t.String(),
	message: t.String(),
	statusCode: t.Number(),
});

// ── Export ────────────────────────────────────

/** Batched status: one DB hit for N productIds (used by listings). */
export const FavoriteStatusBatchResponse = t.Object({
	statuses: t.Record(t.String({ format: "uuid" }), t.Boolean()),
});

// ── Export ────────────────────────────────────

export const FavoritesModel = {
	// Bodies
	addItemBody: AddItemBody,

	// Params
	productIdParams: ProductIdParams,

	// Query
	favoritesListQuery: FavoritesListQuery,
	favoriteStatusBatchQuery: FavoriteStatusBatchQuery,

	// Responses
	favoriteResponse: FavoriteResponse,
	favoriteItemResponse: FavoriteItemResponse,
	favoriteListResponse: FavoriteListResponse,
	favoriteStatusBatchResponse: FavoriteStatusBatchResponse,
} as const;

export type FavoritesModel = {
	[k in keyof typeof FavoritesModel]: UnwrapSchema<(typeof FavoritesModel)[k]>;
};

export type FavoriteItemResponse = typeof FavoriteItemResponse.static;
export type FavoriteListResponse = typeof FavoriteListResponse.static;
export type FavoriteResponse = typeof FavoriteResponse.static;
export type AddItemBody = typeof AddItemBody.static;
