import { offers } from "@renovabit/db/schema";
import { createSelectSchema } from "drizzle-typebox";
import { t } from "elysia";

// ── Error ──────────────────────────────────────────

export const ErrorResponse = t.Object({
	errId: t.String(),
	code: t.String(),
	message: t.String(),
	statusCode: t.Number(),
});

// ── Public offer ref (used by products.model when enriching product responses) ─

export const PublicOfferRef = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	discountValue: t.String(),
	isFeatured: t.Boolean(),
	endsAt: t.Date(),
});

// ── Admin: offer responses ─

const _OfferRow = createSelectSchema(offers);

/** Admin — single offer row. Used by create, getById, update, delete. */
export const OfferResponse = _OfferRow;

/** Admin — list offer row, extended with computed counts. */
export const OfferListResponse = t.Composite([
	_OfferRow,
	t.Object({
		productCount: t.Integer({ minimum: 0 }),
	}),
]);

/** Admin — product assigned to an offer, with product details (name, sku, image). */
const OfferProductDetail = t.Object({
	productId: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	sku: t.String(),
	price: t.String(),
	primaryImage: t.Nullable(
		t.Object({
			url: t.String(),
			alt: t.Nullable(t.String()),
		}),
	),
});

// ── Public: active offer (subset of fields, no createdBy/createdAt/updatedAt) ─

/** Public — basic offer fields (used in detail, then enriched with products). */
const _OfferBase = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	description: t.Nullable(t.String()),
	discountValue: t.String(),
	isFeatured: t.Boolean(),
	startsAt: t.Date(),
	endsAt: t.Date(),
});

/** Public — junction row: just { productId } (no enrichment). */
const OfferProductJunction = t.Object({
	productId: t.String({ format: "uuid" }),
});

/** Public — offer + its product assignments. */
export const OfferWithProductsResponse = t.Composite([
	_OfferBase,
	t.Object({ products: t.Array(OfferProductJunction) }),
]);

// ── Common create fields ─

const _createCommon = t.Object({
	name: t.String({ minLength: 1, maxLength: 100 }),
	slug: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
	description: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
	discountValue: t.Number({ minimum: 0.01, maximum: 100 }),
	startsAt: t.String({ format: "date-time" }),
	endsAt: t.String({ format: "date-time" }),
	isActive: t.Optional(t.Boolean()),
	isFeatured: t.Optional(t.Boolean()),
	productIds: t.Optional(t.Array(t.String({ format: "uuid" }))),
	overrides: t.Optional(
		t.Record(
			t.String({ format: "uuid" }),
			t.Object({
				overrideDiscountValue: t.Optional(t.Nullable(t.Number({ minimum: 0 }))),
			}),
		),
	),
});

const _createBody = _createCommon;

// ── Update body (Partial, no overrides) ─

const _updateCommon = t.Object({
	name: t.String({ minLength: 1, maxLength: 100 }),
	slug: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
	description: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
	discountValue: t.Number({ minimum: 0.01, maximum: 100 }),
	startsAt: t.String({ format: "date-time" }),
	endsAt: t.String({ format: "date-time" }),
	isActive: t.Optional(t.Boolean()),
	isFeatured: t.Optional(t.Boolean()),
	productIds: t.Optional(t.Array(t.String({ format: "uuid" }))),
});

const _productAssignBody = t.Object({
	productIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
	overrides: t.Optional(
		t.Record(
			t.String({ format: "uuid" }),
			t.Object({
				overrideDiscountValue: t.Optional(t.Nullable(t.Number({ minimum: 0 }))),
			}),
		),
	),
});

const _assignResponse = t.Object({
	offerId: t.String({ format: "uuid" }),
	assignedCount: t.Integer({ minimum: 0 }),
});

// ── Consolidated offer list (public) ────────────────

/**
 * A product item in the consolidated offer list, with role-aware prices.
 */
const OfferProductItem = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	sku: t.String(),
	primaryImage: t.Nullable(t.String()),
	brand: t.Nullable(
		t.Object({
			id: t.String({ format: "uuid" }),
			name: t.String(),
			slug: t.String(),
		}),
	),
	basePrice: t.Nullable(t.String()),
	offerPrice: t.Nullable(t.String()),
	discountPercent: t.Integer({ minimum: 0, maximum: 100 }),
	inStock: t.Boolean(),
	stock: t.Integer({ minimum: 0 }),
});

/**
 * A page of products within an offer section.
 */
const OfferProductPage = t.Object({
	items: t.Array(OfferProductItem),
	/** Offset for the next page. Null when all products returned. */
	nextOffset: t.Nullable(t.Integer({ minimum: 0 })),
	total: t.Integer({ minimum: 0 }),
});

/**
 * An offer in the consolidated list, with its first page of products.
 */
const OfferWithProductsListItem = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	description: t.Nullable(t.String()),
	discountValue: t.String(),
	isFeatured: t.Boolean(),
	startsAt: t.Date(),
	endsAt: t.Date(),
	products: OfferProductPage,
});

/**
 * Top-level response for GET /offers (consolidated).
 */
export const OfferListEnrichedResponse = t.Object({
	offers: t.Array(OfferWithProductsListItem),
	filters: t.Object({
		brands: t.Array(
			t.Object({
				id: t.String({ format: "uuid" }),
				name: t.String(),
				slug: t.String(),
			}),
		),
	}),
});

// ── Query schemas (consolidated) ────────────────────

const _offerListQuery = t.Object({
	offset: t.Optional(t.Integer({ minimum: 0, maximum: 10000, default: 0 })),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 20 })),
	isFeatured: t.Optional(t.String({ pattern: "^(true|false)$" })),
	/** Filter offers that have products of these brands (comma-separated brand slugs). */
	brands: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
	/** Load the next page of products for a specific offer. Requires offerId. */
	offerId: t.Optional(t.String({ format: "uuid" })),
	/** Product page offset (requires offerId). */
	productsOffset: t.Optional(t.Integer({ minimum: 0, maximum: 10000, default: 0 })),
	/** Product page limit (requires offerId). */
	productsLimit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 20 })),
	/** Filter products by effective (role-aware) sale price — min bound. */
	minPrice: t.Optional(t.String({ pattern: "^\\d+(\\.\\d{1,2})?$" })),
	/** Filter products by effective (role-aware) sale price — max bound. */
	maxPrice: t.Optional(t.String({ pattern: "^\\d+(\\.\\d{1,2})?$" })),
});

// ── Model ──────────────────────────────────────────

export const OfferModel = {
	// Bodies
	createBody: _createBody,
	updateBody: t.Partial(_updateCommon),
	productAssignBody: _productAssignBody,

	// Params
	idParams: t.Object({ id: t.String({ format: "uuid" }) }),

	// Query
	listQuery: t.Object({
		search: t.Optional(t.String({ maxLength: 100 })),
		isActive: t.Optional(t.String({ pattern: "^(true|false)$" })),
		isFeatured: t.Optional(t.String({ pattern: "^(true|false)$" })),
		from: t.Optional(t.String({ format: "date" })),
		to: t.Optional(t.String({ format: "date" })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 20 })),
		offset: t.Optional(t.Integer({ minimum: 0, maximum: 10000, default: 0 })),
	}),

	// Admin responses
	offerResponse: OfferResponse,
	offerListResponse: t.Object({
		data: t.Array(OfferListResponse),
		total: t.Integer({ minimum: 0 }),
	}),
	offerProductDetailResponse: t.Array(OfferProductDetail),
	assignResponse: _assignResponse,

	// Public responses
	productOffersResponse: t.Array(PublicOfferRef),
	offerWithProductsResponse: OfferWithProductsResponse,

	// Consolidated list (public)
	offerListEnrichedResponse: OfferListEnrichedResponse,

	// Public queries
	offerListQuery: _offerListQuery,

	// Shared
	errorResponse: ErrorResponse,
};

// ── Derived types ───────────────────────────────────

export type CreateOfferDto = typeof OfferModel.createBody.static;
export type UpdateOfferDto = typeof OfferModel.updateBody.static;
export type OfferProductAssignBody = typeof OfferModel.productAssignBody.static;
