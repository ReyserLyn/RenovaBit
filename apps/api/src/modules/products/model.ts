import { products } from "@renovabit/db/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import { t, type UnwrapSchema } from "elysia";

// ── Insert / Update ────────────────────────────────

const _insert = createInsertSchema(products, {
	name: t.String({ minLength: 1, maxLength: 255 }),
	slug: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
	description: t.Optional(t.Nullable(t.String({ maxLength: 10000 }))),
	sku: t.String({ minLength: 1, maxLength: 100 }),
	price: t.String({ minLength: 1, pattern: "^\\d+(\\.\\d{1,2})?$" }),
	stock: t.Optional(t.Integer({ minimum: 0 })),
	brandId: t.Optional(t.Nullable(t.String({ format: "uuid" }))),
	categoryId: t.Optional(t.Nullable(t.String({ format: "uuid" }))),
	isActive: t.Optional(t.Boolean()),
	isFeatured: t.Optional(t.Boolean()),
});

// ── Admin Responses ──────

const AdminProductResponse = createSelectSchema(products);

const ProviderRef = t.Object({
	source: t.String(),
	externalId: t.String(),
});

const AdminProductListResponse = t.Composite([
	AdminProductResponse,
	t.Object({
		imageUrls: t.Array(t.String()),
		imageCount: t.Integer({ minimum: 0 }),
		createdByName: t.Nullable(t.String()),
		updatedByName: t.Nullable(t.String()),
		providerIds: t.Array(ProviderRef),
		reservedStock: t.Integer({ minimum: 0 }),
		availableStock: t.Integer({ minimum: 0 }),
	}),
]);

const BulkDeleteResult = t.Object({
	deletedIds: t.Array(t.String({ format: "uuid" })),
	notFoundIds: t.Array(t.String({ format: "uuid" })),
	deletedCount: t.Integer({ minimum: 0 }),
});

// ── Public Responses ──────────

const PublicBrandRef = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
});

const PublicCategoryRef = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
});

const PublicPrimaryImage = t.Object({
	url: t.String(),
	alt: t.Nullable(t.String()),
});

export const PublicProductListItem = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	price: t.String(),
	stock: t.Integer({ minimum: 0 }),
	sku: t.String(),
	isFeatured: t.Boolean(),
	primaryImage: t.Nullable(PublicPrimaryImage),
	brand: t.Nullable(PublicBrandRef),
	category: t.Nullable(PublicCategoryRef),
});

const PublicSpecification = t.Object({
	id: t.String(),
	key: t.String(),
	value: t.String(),
});

const PublicBrandDetailRef = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	imageUrl: t.Nullable(t.String()),
});

const PublicImageRef = t.Object({
	id: t.String({ format: "uuid" }),
	url: t.String(),
	alt: t.Nullable(t.String()),
	isPrimary: t.Boolean(),
});

export const PublicProductDetail = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	description: t.Nullable(t.String()),
	price: t.String(),
	stock: t.Integer({ minimum: 0 }),
	sku: t.String(),
	specifications: t.Array(PublicSpecification),
	images: t.Array(PublicImageRef),
	brand: t.Nullable(PublicBrandDetailRef),
	category: t.Nullable(PublicCategoryRef),
	createdAt: t.String(),
});

// ── Paginated Response ──────────────────────────────

const PaginatedProductListResponse = t.Object({
	data: t.Array(PublicProductListItem),
	total: t.Integer({ minimum: 0 }),
	offset: t.Integer({ minimum: 0 }),
	limit: t.Integer({ minimum: 1 }),
});

// ── Search Types ────────────────────────────────────

const SearchBrandRef = t.Object({
	name: t.String(),
	slug: t.String(),
});

const SearchCategoryRef = t.Object({
	name: t.String(),
	slug: t.String(),
});

const SearchPrimaryImage = t.Object({
	url: t.String(),
	alt: t.Nullable(t.String()),
});

const ProductSearchResult = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
	sku: t.String(),
	price: t.String(),
	isInStock: t.Boolean(),
	isFeatured: t.Boolean(),
	stock: t.Integer({ minimum: 0 }),
	primaryImage: t.Nullable(SearchPrimaryImage),
	brand: t.Nullable(SearchBrandRef),
	category: t.Nullable(SearchCategoryRef),
	headline: t.Nullable(t.String()),
});

const SearchResponse = t.Object({
	data: t.Array(ProductSearchResult),
	total: t.Integer({ minimum: 0 }),
	limit: t.Integer({ minimum: 1 }),
	offset: t.Integer({ minimum: 0 }),
	hasMore: t.Boolean(),
});

// ── Tipos derivados de schemas ──

export type PaginatedProductListResponse = typeof PaginatedProductListResponse.static;
export type PublicProductListItem = typeof PublicProductListItem.static;
export type PublicProductDetail = typeof PublicProductDetail.static;
export type BulkDeleteResult = typeof BulkDeleteResult.static;
export type ProductSearchResult = typeof ProductSearchResult.static;
export type SearchResponse = typeof SearchResponse.static;

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
		brands: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
		categoryId: t.Optional(t.String({ format: "uuid" })),
		categorySlug: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
		isFeatured: t.Optional(t.Boolean()),
		search: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
		sortBy: t.Optional(
			t.String({
				minLength: 1,
				pattern: "^(price_asc|price_desc|name_asc|name_desc|newest)$",
			}),
		),
		minPrice: t.Optional(
			t.String({
				minLength: 1,
				pattern: "^\\d+(\\.\\d{1,2})?$",
			}),
		),
		maxPrice: t.Optional(
			t.String({
				minLength: 1,
				pattern: "^\\d+(\\.\\d{1,2})?$",
			}),
		),
		offset: t.Optional(t.Integer({ minimum: 0, maximum: 10000, default: 0 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 20 })),
		excludeSlug: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
	}),

	// Batch
	bulkDeleteBody: t.Object({
		ids: t.Array(t.String({ format: "uuid" }), { minItems: 1, maxItems: 50 }),
	}),

	// Admin Responses
	adminProductResponse: AdminProductResponse,
	adminProductListResponse: t.Array(AdminProductListResponse),
	bulkDeleteResponse: BulkDeleteResult,

	// Search
	searchQuery: t.Object({
		q: t.String({ minLength: 2, maxLength: 100 }),
		brands: t.Optional(t.String({ minLength: 1, maxLength: 500 })),
		minPrice: t.Optional(
			t.String({
				minLength: 1,
				pattern: "^\\d+(\\.\\d{1,2})?$",
			}),
		),
		maxPrice: t.Optional(
			t.String({
				minLength: 1,
				pattern: "^\\d+(\\.\\d{1,2})?$",
			}),
		),
		sortBy: t.Optional(
			t.String({
				minLength: 1,
				pattern: "^(price_asc|price_desc|name_asc|name_desc|newest)$",
			}),
		),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 20 })),
		offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
	}),
	searchResponse: SearchResponse,

	// Public Responses
	publicProductListItem: PublicProductListItem,
	publicProductListResponse: PaginatedProductListResponse,
	publicProductDetail: PublicProductDetail,
} as const;

export type ProductModel = {
	[k in keyof typeof ProductModel]: UnwrapSchema<(typeof ProductModel)[k]>;
};
