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
	discountType: t.Union([t.Literal("percentage"), t.Literal("fixed_amount")]),
	discountValue: t.String(),
	isFeatured: t.Boolean(),
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
		brandCount: t.Integer({ minimum: 0 }),
		categoryCount: t.Integer({ minimum: 0 }),
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

/** Admin — brand assigned to an offer, with product count. */
const OfferBrandDetail = t.Object({
	brandId: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	productCount: t.Integer({ minimum: 0 }),
});

/** Admin — category assigned to an offer, with product count. */
const OfferCategoryDetail = t.Object({
	categoryId: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	productCount: t.Integer({ minimum: 0 }),
});

// ── Public: active offer (subset of fields, no createdBy/createdAt/updatedAt) ─

/** Public — active offer with computed counts (used in list). */
export const OfferActiveResponse = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	description: t.Nullable(t.String()),
	type: t.Union([t.Literal("product"), t.Literal("category"), t.Literal("brand")]),
	discountType: t.Union([t.Literal("percentage"), t.Literal("fixed_amount")]),
	discountValue: t.String(),
	isFeatured: t.Boolean(),
	startsAt: t.Date(),
	endsAt: t.Date(),
	productCount: t.Integer({ minimum: 0 }),
	brandCount: t.Integer({ minimum: 0 }),
	categoryCount: t.Integer({ minimum: 0 }),
});

/** Public — basic offer fields (used in detail, then enriched with products/brands/categories). */
const _OfferBase = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	description: t.Nullable(t.String()),
	type: t.Union([t.Literal("product"), t.Literal("category"), t.Literal("brand")]),
	discountType: t.Union([t.Literal("percentage"), t.Literal("fixed_amount")]),
	discountValue: t.String(),
	isFeatured: t.Boolean(),
	startsAt: t.Date(),
	endsAt: t.Date(),
});

/** Public — junction row: just { productId } (no enrichment). */
const OfferProductJunction = t.Object({
	productId: t.String({ format: "uuid" }),
});

/** Public — junction row: just { brandId }. */
const OfferBrandJunction = t.Object({
	brandId: t.String({ format: "uuid" }),
});

/** Public — junction row: just { categoryId }. */
const OfferCategoryJunction = t.Object({
	categoryId: t.String({ format: "uuid" }),
});

/** Public — offer + its product assignments (type=product). */
export const OfferWithProductsResponse = t.Composite([
	_OfferBase,
	t.Object({ products: t.Array(OfferProductJunction) }),
]);

/** Public — offer + its brand assignments (type=brand). */
export const OfferWithBrandsResponse = t.Composite([
	_OfferBase,
	t.Object({ brands: t.Array(OfferBrandJunction) }),
]);

/** Public — offer + its category assignments (type=category). */
export const OfferWithCategoriesResponse = t.Composite([
	_OfferBase,
	t.Object({ categories: t.Array(OfferCategoryJunction) }),
]);

// ── Bodies ──────────────────────────────────────────

const _createBody = t.Object({
	name: t.String({ minLength: 1, maxLength: 100 }),
	slug: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
	description: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
	discountType: t.Union([t.Literal("percentage"), t.Literal("fixed_amount")]),
	// percentage: capped at 100 in service.ts (see MAX_OFFER_DISCOUNT_PERCENT)
	// fixed_amount: validated against per-product price in service.ts (no static max)
	discountValue: t.Number({ minimum: 0, maximum: 100_000 }),
	startsAt: t.String({ format: "date-time" }),
	endsAt: t.String({ format: "date-time" }),
	isActive: t.Optional(t.Boolean()),
	isFeatured: t.Optional(t.Boolean()),
	type: t.Optional(t.Union([t.Literal("product"), t.Literal("category"), t.Literal("brand")])),
	productIds: t.Optional(t.Array(t.String({ format: "uuid" }))),
	brandIds: t.Optional(t.Array(t.String({ format: "uuid" }))),
	categoryIds: t.Optional(t.Array(t.String({ format: "uuid" }))),
	overrides: t.Optional(
		t.Record(
			t.String({ format: "uuid" }),
			t.Object({
				overrideDiscountType: t.Optional(
					t.Union([t.Literal("percentage"), t.Literal("fixed_amount")]),
				),
				overrideDiscountValue: t.Optional(t.Number({ minimum: 0 })),
			}),
		),
	),
});

const _productAssignBody = t.Object({
	productIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
	overrides: t.Optional(
		t.Record(
			t.String({ format: "uuid" }),
			t.Object({
				overrideDiscountType: t.Optional(
					t.Union([t.Literal("percentage"), t.Literal("fixed_amount")]),
				),
				overrideDiscountValue: t.Optional(t.Number({ minimum: 0 })),
			}),
		),
	),
});

const _assignResponse = t.Object({
	offerId: t.String({ format: "uuid" }),
	assignedCount: t.Integer({ minimum: 0 }),
});

// ── Model ──────────────────────────────────────────

export const OfferModel = {
	// Bodies
	createBody: _createBody,
	updateBody: t.Partial(t.Omit(_createBody, ["overrides"])),
	productAssignBody: _productAssignBody,
	brandAssignBody: t.Object({
		brandIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
	}),
	categoryAssignBody: t.Object({
		categoryIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
	}),

	// Params
	idParams: t.Object({ id: t.String({ format: "uuid" }) }),
	slugParams: t.Object({ slug: t.String({ minLength: 1, maxLength: 100 }) }),

	// Query
	listQuery: t.Object({
		search: t.Optional(t.String({ maxLength: 100 })),
		isActive: t.Optional(t.String({ pattern: "^(true|false)$" })),
		isFeatured: t.Optional(t.String({ pattern: "^(true|false)$" })),
		from: t.Optional(t.String({ format: "date" })),
		to: t.Optional(t.String({ format: "date" })),
	}),

	// Admin responses
	offerResponse: OfferResponse,
	offerListResponse: t.Array(OfferListResponse),
	offerProductDetailResponse: t.Array(OfferProductDetail),
	offerBrandDetailResponse: t.Array(OfferBrandDetail),
	offerCategoryDetailResponse: t.Array(OfferCategoryDetail),
	assignResponse: _assignResponse,

	// Public responses
	offerActiveListResponse: t.Array(OfferActiveResponse),
	productOffersResponse: t.Array(PublicOfferRef),
	offerWithProductsResponse: OfferWithProductsResponse,
	offerWithBrandsResponse: OfferWithBrandsResponse,
	offerWithCategoriesResponse: OfferWithCategoriesResponse,

	// Shared
	errorResponse: ErrorResponse,
};

// ── Derived types ───────────────────────────────────

export type CreateOfferDto = typeof OfferModel.createBody.static;
export type UpdateOfferDto = typeof OfferModel.updateBody.static;
export type OfferProductAssignBody = typeof OfferModel.productAssignBody.static;
export type OfferBrandAssignBody = typeof OfferModel.brandAssignBody.static;
export type OfferCategoryAssignBody = typeof OfferModel.categoryAssignBody.static;
