import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import {
	brands,
	categories,
	productChanges,
	productImages,
	products,
	syncReports,
} from "@renovabit/db/schema";
import { getEffectiveSalePrice, type Role } from "@renovabit/pricing";
import type { InferSelectModel } from "drizzle-orm";
import {
	and,
	asc,
	count,
	desc,
	eq,
	getTableColumns,
	ilike,
	inArray,
	ne,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { MAX_BULK_DELETE, SEARCH_PAYLOAD_CAP, SLOW_QUERY_THRESHOLD_MS } from "@/constants";
import { enrichPublicPricing } from "@/utils/catalog-enrichment";
import { getCategoryAndDescendantIds } from "@/utils/category-helpers";
import { handleUniqueViolation, makeSlug } from "@/utils/db-helpers";
import { logger } from "@/utils/logger";
import { getActiveMarginRules } from "@/utils/margin-rules";
import { buildPrefixTsQuery, escapeLikePattern } from "@/utils/prefix-tsquery";
import { reviewVisibleCondition } from "@/utils/product-visibility";
import { recomputeReviewReasons } from "@/utils/review-reasons";
import { getReservedStockSubquery } from "@/utils/stock";
import { deleteEntityFolder } from "@/utils/storage/helpers";
import { activeOffersForProductSubquery } from "../offers/service";
import type {
	BulkDeleteResult,
	ProductModel,
	ProductSearchResult,
	PublicProductDetail,
	PublicProductListItem,
} from "./model";

// ── Types ──────────────────────────────────────────

type Product = InferSelectModel<typeof products>;

export type ProductWithImage = Product & {
	imageUrls: string[];
	imageCount: number;
	createdByName: string | null;
	updatedByName: string | null;
	providerIds: Array<{ source: string; externalId: string }>;
	reservedStock: number;
	availableStock: number;
	/** Customer price with the best active offer applied; null when none applies. */
	effectivePrice: string | null;
	/** Name of the winning offer; null when `effectivePrice` is null. */
	activeOfferName: string | null;
};

/** Admin detail row: the product plus the availability pair the list exposes. */
export type AdminProductDetail = Product &
	Pick<ProductWithImage, "reservedStock" | "availableStock">;

/**
 * Options for public listings. Admin `list()` ignores `limit`/`offset` —
 * it always returns the full filtered set, and the client-side TanStack
 * table paginates the result.
 */
type ListOptions = {
	brandId?: string;
	brandIds?: string[];
	brandSlugs?: string;
	categoryId?: string;
	categorySlug?: string;
	/** Comma-separated category slugs (multi-select). Used by /productos. */
	categorySlugs?: string;
	isFeatured?: boolean;
	search?: string;
	sortBy?: string;
	minPrice?: string;
	maxPrice?: string;
	offset?: number;
	limit?: number;
	excludeSlug?: string;
	role?: Role;
};

type CreateBody = ProductModel["createBody"];
type UpdateBody = ProductModel["updateBody"];

// ── Constants ──────────────────────────────────────

/** Condiciones para detalle de producto (seguir mostrando aunque esté agotado) */
const PUBLIC_DETAIL_CONDITIONS = [
	eq(products.isActive, true),
	// Advisory reasons (e.g. "Sin imagen") flag the operator without hiding the
	// product; blocking reasons still do.
	reviewVisibleCondition,
] as const;

/** Condiciones para listados públicos */
const PUBLIC_LIST_CONDITIONS = [
	...PUBLIC_DETAIL_CONDITIONS,
	sql`${products.stock} > (${getReservedStockSubquery(products.id)})`,
] as const;

// ── FK validation ──────────────────────────────────

async function ensureBrandExists(brandId: string | null | undefined): Promise<void> {
	if (!brandId) return;
	const [brand] = await db
		.select({ id: brands.id })
		.from(brands)
		.where(eq(brands.id, brandId))
		.limit(1);
	if (!brand) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "La marca especificada no existe",
			logLevel: "info",
			doNotLog: true,
		});
	}
}

async function ensureCategoryExists(categoryId: string | null | undefined): Promise<void> {
	if (!categoryId) return;
	const [cat] = await db
		.select({ id: categories.id })
		.from(categories)
		.where(eq(categories.id, categoryId))
		.limit(1);
	if (!cat) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "La categoría especificada no existe",
			logLevel: "info",
			doNotLog: true,
		});
	}
}

// ── Unique checks ──────────────────────────────────

async function ensureUnique(
	field: typeof products.name | typeof products.slug | typeof products.sku,
	value: string,
	label: string,
	excludeId?: string,
): Promise<void> {
	const conditions = [eq(field, value)];
	if (excludeId) conditions.push(ne(products.id, excludeId));
	const [existing] = await db
		.select({ id: products.id })
		.from(products)
		.where(and(...conditions))
		.limit(1);
	if (existing) {
		throw createApiError({
			code: BackendErrorCodes.EXISTS_ERROR,
			message: `Ya existe un producto con este ${label}`,
			logLevel: "info",
			doNotLog: true,
		});
	}
}

// ── Where clause builder ───────────────────────────

function buildWhere(options: ListOptions, isPublic: boolean, categoryIds?: string[]) {
	const conditions = [];

	if (isPublic) {
		conditions.push(...PUBLIC_LIST_CONDITIONS);
	}

	if (options.brandIds?.length) {
		conditions.push(inArray(products.brandId, options.brandIds));
	} else if (options.brandId) {
		conditions.push(eq(products.brandId, options.brandId));
	}
	if (categoryIds?.length) {
		conditions.push(inArray(products.categoryId, categoryIds));
	} else if (options.categoryId) {
		conditions.push(eq(products.categoryId, options.categoryId));
	}
	if (options.isFeatured !== undefined)
		conditions.push(eq(products.isFeatured, options.isFeatured));
	if (options.excludeSlug) conditions.push(ne(products.slug, options.excludeSlug));
	if (options.search) {
		const escaped = escapeLikePattern(options.search);
		const term = `%${escaped}%`;
		conditions.push(or(ilike(products.name, term), ilike(products.sku, term)) ?? undefined);
	}
	// NOTE: price filter is applied in JS after computing the role-specific price.
	// The stored `products.price` is the customer price (computed from supplierPrice + margins),
	// not the buyer's role price, so SQL-level filtering would be wrong for admin views.

	return conditions.length === 0 ? undefined : and(...conditions);
}

// ── OrderBy builder ──────────────────────────────

const SORT_MAP = {
	price_asc: [asc(products.price), asc(products.id)] as const,
	price_desc: [desc(products.price), asc(products.id)] as const,
	name_asc: [asc(products.name), asc(products.id)] as const,
	name_desc: [desc(products.name), asc(products.id)] as const,
	newest: [desc(products.createdAt), asc(products.id)] as const,
} as const;

type SortByKey = keyof typeof SORT_MAP;

function isSortByKey(value: string): value is SortByKey {
	return value in SORT_MAP;
}

function buildOrderBy(sortBy?: string) {
	if (sortBy && isSortByKey(sortBy)) {
		return [...SORT_MAP[sortBy]];
	}
	return [asc(products.price), asc(products.id)];
}

// ═══════════════════════════════════════════════════
//  ADMIN QUERIES
// ═══════════════════════════════════════════════════

async function list(options: ListOptions = {}): Promise<ProductWithImage[]> {
	const rows = await db
		.select({
			...getTableColumns(products),
			// Same active-offer aggregation the storefront listing uses, so the
			// admin sees the offer the customer would actually get.
			offers: activeOffersForProductSubquery(),
			imageUrls: sql<string[]>`COALESCE(
				(
					SELECT jsonb_agg(url ORDER BY sort_order, created_at)
					FROM (
						SELECT pi2.url, pi2.sort_order, pi2.created_at
						FROM product_images pi2
						WHERE pi2.product_id = products.id
						ORDER BY pi2.sort_order ASC NULLS LAST, pi2.created_at ASC
						LIMIT 3
					) limited
				),
				'[]'::jsonb
			)`,
			imageCount: sql<number>`(
				SELECT COUNT(*)::int
				FROM product_images pi3
				WHERE pi3.product_id = products.id
			)`,
			createdByName: sql<string | null>`(
				SELECT u.name FROM users u WHERE u.id = products.created_by
			)`,
			updatedByName: sql<string | null>`(
				SELECT u.name FROM users u WHERE u.id = products.updated_by
			)`,
			providerIds: sql<Array<{ source: string; externalId: string }>>`COALESCE(
				(
					SELECT jsonb_agg(jsonb_build_object('source', pp.source, 'externalId', pp.external_id))
					FROM product_providers pp
					WHERE pp.product_id = products.id
				),
				'[]'::jsonb
			)`,
			reservedStock: sql<number>`COALESCE((${getReservedStockSubquery(products.id)})::int, 0)`,
			availableStock: sql<number>`GREATEST(0, ${products.stock} - COALESCE((${getReservedStockSubquery(products.id)})::int, 0))`,
		})
		.from(products)
		.where(buildWhere(options, false))
		.orderBy(desc(products.createdAt));

	// The admin table shows what the store charges: base price plus the best
	// active offer, computed with the same catalog pricing SSOT as the
	// storefront (`enrichPublicPricing`), never by re-deriving the math here.
	const marginRules = await getActiveMarginRules();
	return rows.map((row) => {
		const { offerPriceStr, bestOfferId } = enrichPublicPricing({
			row,
			role: "customer",
			marginRules,
		});
		const { offers, ...product } = row;
		return {
			...product,
			effectivePrice: offerPriceStr,
			activeOfferName: offerPriceStr
				? (offers.find((offer) => offer.id === bestOfferId)?.name ?? null)
				: null,
		};
	});
}

async function getBySlug(slug: string): Promise<Product | null> {
	const [row] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
	return row ?? null;
}

async function getById(id: string): Promise<AdminProductDetail | null> {
	const [row] = await db
		.select({
			...getTableColumns(products),
			reservedStock: sql<number>`COALESCE((${getReservedStockSubquery(products.id)})::int, 0)`,
			availableStock: sql<number>`GREATEST(0, ${products.stock} - COALESCE((${getReservedStockSubquery(products.id)})::int, 0))`,
		})
		.from(products)
		.where(eq(products.id, id))
		.limit(1);
	return row ?? null;
}

async function getByIdStrict(id: string): Promise<Product> {
	const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
	if (!row) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Producto no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}
	return row;
}

// ═══════════════════════════════════════════════════
//  PUBLIC QUERIES
// ═══════════════════════════════════════════════════

async function listPublic(
	options: ListOptions = {},
): Promise<{ data: PublicProductListItem[]; total: number; offset: number; limit: number }> {
	// ── Resolve slugs → IDs (agregación de descendientes para categorías) ──
	let categoryIds: string[] | undefined;
	if (options.categorySlugs) {
		// Multi-select: union of all leaf/parent IDs (con descendientes).
		const slugs = options.categorySlugs
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		if (slugs.length > 0) {
			const idSet = new Set<string>();
			for (const slug of slugs) {
				const ids = await getCategoryAndDescendantIds(slug);
				for (const id of ids) idSet.add(id);
			}
			if (idSet.size === 0) {
				return { data: [], total: 0, offset: options.offset ?? 0, limit: options.limit ?? 20 };
			}
			categoryIds = [...idSet];
		}
	} else if (options.categorySlug) {
		categoryIds = await getCategoryAndDescendantIds(options.categorySlug);
		if (categoryIds.length === 0) {
			return { data: [], total: 0, offset: options.offset ?? 0, limit: options.limit ?? 20 };
		}
	}

	// ── Resolve brand slug (single, for backward compat) ──
	let resolvedBrandId = options.brandId;
	if (options.brandSlugs) {
		const slugs = options.brandSlugs
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		if (slugs.length > 0) {
			const rows = await db
				.select({ id: brands.id })
				.from(brands)
				.where(inArray(brands.slug, slugs));
			if (rows.length === 0) {
				return { data: [], total: 0, offset: options.offset ?? 0, limit: options.limit ?? 20 };
			}
			resolvedBrandId = undefined;
			const brandIds = rows.map((r) => r.id);
			options.brandIds = brandIds;
		}
	}

	const resolvedOptions: ListOptions = { ...options, brandId: resolvedBrandId };
	const where = buildWhere(resolvedOptions, true, categoryIds);

	const offset = resolvedOptions.offset ?? 0;
	const limit = resolvedOptions.limit ?? 20;
	const role: Role = resolvedOptions.role ?? "customer";
	const sortBy = resolvedOptions.sortBy;

	// ── Pagination strategy (two routes) ──
	// Role-aware pricing (margins + best offer) happens in JS after the fetch,
	// so price filtering and price sorting cannot be expressed in SQL:
	// `products.price` is the stored list price — stale for other roles and for
	// the effective (offer-aware) price. When either is requested, SQL
	// LIMIT/OFFSET would cut the wrong window and COUNT would include rows the
	// JS filter drops (gaps between pages, inflated total). Fetch the whole
	// WHERE set, enrich, then filter/sort/slice in JS. Otherwise SQL
	// LIMIT/OFFSET + COUNT is exact and cheap.
	//
	// TODO(perf): if the catalog grows much larger, materialize the effective
	// price (per role + best offer) and paginate it in SQL.
	const priceMin = options.minPrice ? Number.parseFloat(options.minPrice) : null;
	const priceMax = options.maxPrice ? Number.parseFloat(options.maxPrice) : null;
	const hasPriceFilter = priceMin !== null || priceMax !== null;
	const needsJsPagination = hasPriceFilter || sortBy === "price_asc" || sortBy === "price_desc";

	const selectRows = () =>
		db
			.select({
				id: products.id,
				name: products.name,
				slug: products.slug,
				supplierPrice: products.supplierPrice,
				roleCustomMargins: products.roleCustomMargins,
				managedBy: products.managedBy,
				price: products.price,
				stock: sql<number>`GREATEST(0, ${products.stock} - (${getReservedStockSubquery(products.id)})::int)`,
				sku: products.sku,
				isFeatured: products.isFeatured,
				primaryImageUrl: sql<string | null>`(
				SELECT pi.url FROM product_images pi
				WHERE pi.product_id = ${products.id}
				ORDER BY pi.is_primary DESC, pi.sort_order ASC NULLS LAST
				LIMIT 1
			)`,
				primaryImageAlt: sql<string | null>`(
				SELECT pi.alt FROM product_images pi
				WHERE pi.product_id = ${products.id}
				ORDER BY pi.is_primary DESC, pi.sort_order ASC NULLS LAST
				LIMIT 1
			)`,
				brandId: brands.id,
				brandName: brands.name,
				brandSlug: brands.slug,
				categoryId: categories.id,
				categoryName: categories.name,
				categorySlug: categories.slug,
				offers: activeOffersForProductSubquery(),
			})
			.from(products)
			.leftJoin(brands, eq(products.brandId, brands.id))
			.leftJoin(categories, eq(products.categoryId, categories.id))
			.where(where)
			.orderBy(...buildOrderBy(sortBy));

	const rawRows = needsJsPagination
		? await selectRows()
		: await selectRows().offset(offset).limit(limit);
	type Row = (typeof rawRows)[number];

	// SQL path: count the full WHERE set. JS path: the exact total is computed
	// after pricing/filtering below.
	let total = 0;
	if (!needsJsPagination) {
		const [countRow] = await db
			.select({ total: count(products.id) })
			.from(products)
			.where(where);
		total = Number(countRow?.total ?? 0);
	}

	const marginRules = await getActiveMarginRules();

	type Enriched = {
		row: Row;
		basePrice: number;
		offerPrice: string | null;
		discountPercent: number;
		effectivePrice: number;
	};

	let enriched: Enriched[] = rawRows.map((row) => {
		const { salePrice, offerPriceStr, discountPercent, effectivePrice } = enrichPublicPricing({
			row,
			role,
			marginRules,
		});
		return {
			row,
			basePrice: salePrice,
			offerPrice: offerPriceStr,
			discountPercent,
			effectivePrice,
		};
	});

	if (needsJsPagination) {
		enriched = enriched.filter(({ effectivePrice }) => {
			if (priceMin !== null && effectivePrice < priceMin) return false;
			if (priceMax !== null && effectivePrice > priceMax) return false;
			return true;
		});

		// Effective-price sort: the stored column can disagree with the
		// offer-aware price. The id tiebreak keeps pages stable.
		if (sortBy === "price_asc") {
			enriched.sort(
				(a, b) => a.effectivePrice - b.effectivePrice || a.row.id.localeCompare(b.row.id),
			);
		} else if (sortBy === "price_desc") {
			enriched.sort(
				(a, b) => b.effectivePrice - a.effectivePrice || a.row.id.localeCompare(b.row.id),
			);
		}

		total = enriched.length;
	}

	// SQL path is already paginated; JS path slices after enriching/filtering.
	const paginated = needsJsPagination ? enriched.slice(offset, offset + limit) : enriched;

	const data: PublicProductListItem[] = paginated.map(
		({ row, basePrice, offerPrice, discountPercent }) => ({
			id: row.id,
			name: row.name,
			slug: row.slug,
			price: basePrice.toFixed(2),
			offerPrice,
			discountPercent,
			stock: row.stock,
			isInStock: row.stock > 0,
			sku: row.sku,
			isFeatured: row.isFeatured,
			primaryImage: row.primaryImageUrl
				? { url: row.primaryImageUrl, alt: row.primaryImageAlt }
				: null,
			brand: row.brandId ? { id: row.brandId, name: row.brandName!, slug: row.brandSlug! } : null,
			category: row.categoryId
				? { id: row.categoryId, name: row.categoryName!, slug: row.categorySlug! }
				: null,
			offers: row.offers,
		}),
	);

	return { data, total, offset, limit };
}

async function getBySlugPublic(
	slug: string,
	role: Role = "customer",
): Promise<PublicProductDetail | null> {
	const [row] = await db
		.select({
			id: products.id,
			name: products.name,
			slug: products.slug,
			description: products.description,
			supplierPrice: products.supplierPrice,
			roleCustomMargins: products.roleCustomMargins,
			managedBy: products.managedBy,
			price: products.price,
			stock: sql<number>`GREATEST(0, ${products.stock} - (${getReservedStockSubquery(products.id)})::int)`,
			sku: products.sku,
			specifications: products.specifications,
			createdAt: products.createdAt,
			brandId: brands.id,
			brandName: brands.name,
			brandSlug: brands.slug,
			brandImageUrl: brands.imageUrl,
			categoryId: categories.id,
			categoryName: categories.name,
			categorySlug: categories.slug,
			images: sql<{ id: string; url: string; alt: string | null; isPrimary: boolean }[]>`COALESCE(
				(SELECT jsonb_agg(
					jsonb_build_object(
						'id', pi.id,
						'url', pi.url,
						'alt', pi.alt,
						'isPrimary', pi.is_primary
					) ORDER BY pi.sort_order ASC NULLS LAST, pi.created_at ASC
				)
				FROM product_images pi
				WHERE pi.product_id = ${products.id}),
				'[]'::jsonb
			)`,
			offers: activeOffersForProductSubquery(),
		})
		.from(products)
		.leftJoin(brands, eq(products.brandId, brands.id))
		.leftJoin(categories, eq(products.categoryId, categories.id))
		.where(and(eq(products.slug, slug), ...PUBLIC_DETAIL_CONDITIONS))
		.limit(1);

	if (!row) return null;

	const marginRules = await getActiveMarginRules();
	const { basePriceStr, offerPriceStr, discountPercent } = enrichPublicPricing({
		row,
		role,
		marginRules,
	});

	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		description: row.description,
		price: basePriceStr,
		offerPrice: offerPriceStr,
		discountPercent,
		stock: row.stock,
		isInStock: row.stock > 0,
		sku: row.sku,
		specifications: row.specifications ?? [],
		images: row.images,
		brand: row.brandId
			? { id: row.brandId, name: row.brandName!, slug: row.brandSlug!, imageUrl: row.brandImageUrl }
			: null,
		category: row.categoryId
			? { id: row.categoryId, name: row.categoryName!, slug: row.categorySlug! }
			: null,
		offers: row.offers,
		createdAt: row.createdAt.toISOString(),
	};
}

// ═══════════════════════════════════════════════════
//  CREATE / UPDATE / DELETE (admin)
// ═══════════════════════════════════════════════════

async function create(data: CreateBody, userId: string): Promise<Product> {
	const nextName = data.name.trim();
	const nextSlug = data.slug?.trim() ? makeSlug(data.slug) : makeSlug(nextName);

	if (!nextSlug) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "El slug del producto no puede estar vacío",
			logLevel: "info",
			doNotLog: true,
		});
	}

	await ensureUnique(products.name, nextName, "nombre");
	await ensureUnique(products.slug, nextSlug, "slug");
	await ensureUnique(products.sku, data.sku, "SKU");
	await ensureBrandExists(data.brandId);
	await ensureCategoryExists(data.categoryId);

	// Admin-created products are owner-managed (`manual`) — that is server-owned:
	// `managedBy` is excluded from createBody, so no client input can flip it.
	// The price sent in the body is respected; without one, seed `price` from
	// supplierPrice + margins.
	const supplierPrice = data.supplierPrice ?? "0";
	const marginRules = await getActiveMarginRules();
	const { salePrice } = getEffectiveSalePrice(
		{ supplierPrice, roleCustomMargins: data.roleCustomMargins ?? null },
		"customer",
		marginRules,
	);
	const nextPrice = typeof data.price === "string" ? data.price : salePrice.toFixed(2);

	const [item] = await db
		.insert(products)
		.values({
			name: nextName,
			slug: nextSlug,
			description: data.description,
			price: nextPrice,
			sku: data.sku,
			stock: data.stock,
			managedBy: "manual",
			supplierPrice,
			roleCustomMargins: data.roleCustomMargins ?? null,
			brandId: data.brandId,
			categoryId: data.categoryId,
			specifications: data.specifications,
			isActive: data.isActive,
			isFeatured: data.isFeatured,
			createdBy: userId,
			updatedBy: userId,
		})
		.returning()
		.catch((err) =>
			handleUniqueViolation(err, "Ya existe un producto con este nombre, slug o SKU"),
		);

	if (!item) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al crear el producto",
		});
	}

	return item;
}

// ── Update ─────────────────────────────────────────

async function update(id: string, data: UpdateBody, userId: string): Promise<Product> {
	const current = await getByIdStrict(id);

	const nextName = typeof data.name === "string" ? data.name.trim() : current.name;
	const nextSlug =
		typeof data.slug === "string"
			? makeSlug(data.slug)
			: data.name
				? makeSlug(nextName)
				: current.slug;

	if (!nextSlug) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "El slug del producto no puede estar vacío",
			logLevel: "info",
			doNotLog: true,
		});
	}

	if (nextName !== current.name) await ensureUnique(products.name, nextName, "nombre", id);
	if (nextSlug !== current.slug) await ensureUnique(products.slug, nextSlug, "slug", id);
	if (data.sku && data.sku !== current.sku) await ensureUnique(products.sku, data.sku, "SKU", id);

	if (data.brandId !== undefined) await ensureBrandExists(data.brandId);
	if (data.categoryId !== undefined) await ensureCategoryExists(data.categoryId);

	// Pricing inputs: `supplierPrice` and `roleCustomMargins`.
	// `roleCustomMargins` is the single source of truth for per-role overrides.
	const patch: { supplierPrice?: string; roleCustomMargins?: typeof data.roleCustomMargins } = {};
	if (data.supplierPrice !== undefined) {
		patch.supplierPrice = data.supplierPrice;
	}
	if (data.roleCustomMargins !== undefined) {
		patch.roleCustomMargins = data.roleCustomMargins;
	}

	// Pricing: provider products always derive `price` from supplierPrice +
	// margins. Owner-managed (`manual`) products accept `price` from the body —
	// it's their price.
	const nextManagedBy = data.managedBy ?? current.managedBy;
	const isManualProduct = nextManagedBy === "manual";

	const pricingTouched = patch.supplierPrice !== undefined || patch.roleCustomMargins !== undefined;

	// Provider products must have a real cost: with supplierPrice 0 they would
	// display and sell at S/ 0.00 until the next sync corrects them.
	if (!isManualProduct && (pricingTouched || current.managedBy === "manual")) {
		const effectiveSupplierPrice = Number.parseFloat(patch.supplierPrice ?? current.supplierPrice);
		if (!Number.isFinite(effectiveSupplierPrice) || effectiveSupplierPrice <= 0) {
			throw createApiError({
				code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
				message: "Un producto del proveedor necesita un costo (supplierPrice) mayor a 0",
				logLevel: "info",
				doNotLog: true,
			});
		}
	}

	let computedPrice: string | undefined;
	if (pricingTouched) {
		const supplierPrice = patch.supplierPrice ?? current.supplierPrice;
		const roleCustomMargins = patch.roleCustomMargins ?? current.roleCustomMargins;
		const marginRules = await getActiveMarginRules();
		const { salePrice } = getEffectiveSalePrice(
			{ supplierPrice, roleCustomMargins },
			"customer",
			marginRules,
		);
		computedPrice = salePrice.toFixed(2);
	}

	const { price: bodyPrice, supplierPrice: _sp, ...rest } = data;
	const nextPrice = isManualProduct
		? typeof bodyPrice === "string"
			? bodyPrice
			: computedPrice
		: computedPrice;
	const baseUpdate = {
		...rest,
		...patch,
		...(nextPrice !== undefined ? { price: nextPrice } : {}),
		name: nextName,
		slug: nextSlug,
		updatedBy: userId,
	};

	const [item] = await db
		.update(products)
		.set(baseUpdate)
		.where(eq(products.id, id))
		.returning()
		.catch((err) =>
			handleUniqueViolation(err, "Ya existe un producto con este nombre, slug o SKU"),
		);

	if (!item) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Producto no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	// A stale review reason keeps a product hidden from the storefront forever
	// (it happened in production: 16 products stuck behind "Sin marca"). An admin
	// saving the product means the causes were looked at, so the objective reasons
	// are reconciled with the stored state instead of only being appended.
	const [existingImage] = await db
		.select({ id: productImages.id })
		.from(productImages)
		.where(eq(productImages.productId, id))
		.limit(1);

	const reconciled = recomputeReviewReasons(item.reviewReason, {
		hasBrand: item.brandId !== null,
		hasCategory: item.categoryId !== null,
		hasImage: Boolean(existingImage),
		reviewedByAdmin: true,
	});

	let saved = item;
	if (
		reconciled.needsReview !== item.needsReview ||
		reconciled.reviewReason !== item.reviewReason
	) {
		const [updated] = await db
			.update(products)
			.set({ needsReview: reconciled.needsReview, reviewReason: reconciled.reviewReason })
			.where(eq(products.id, id))
			.returning();
		if (updated) saved = updated;
	}

	// Audit trail for control handovers (who took/released stock control).
	if (data.managedBy !== undefined && data.managedBy !== current.managedBy) {
		await db.insert(productChanges).values({
			productId: id,
			userId,
			source: "admin",
			changeType: "manual_control",
			field: "managed_by",
			oldValue: { managedBy: current.managedBy },
			newValue: { managedBy: data.managedBy },
			reason:
				data.managedBy === "manual"
					? "Control manual del producto: el sync deja de escribir stock y precio"
					: "Control devuelto al proveedor",
		});
	}

	// Audit real price/stock edits from the panel (`item` carries the stored
	// values after the update; provider products only change price when their
	// pricing inputs changed). Nothing is logged when the value is unchanged.
	const auditRows: Array<typeof productChanges.$inferInsert> = [];
	if (Number(item.price) !== Number(current.price)) {
		auditRows.push({
			productId: id,
			userId,
			source: "admin",
			changeType: "price_changed",
			field: "price",
			oldValue: { price: current.price },
			newValue: { price: item.price },
			reason: "Edición manual desde el panel",
		});
	}
	if (item.stock !== current.stock) {
		auditRows.push({
			productId: id,
			userId,
			source: "admin",
			changeType: "stock_changed",
			field: "stock",
			oldValue: { stock: current.stock },
			newValue: { stock: item.stock },
			reason: "Edición manual desde el panel",
		});
	}
	if (auditRows.length > 0) {
		await db.insert(productChanges).values(auditRows);
	}

	return saved;
}

// ── Delete ─────────────────────────────────────────

async function deleteById(id: string): Promise<Product> {
	const [deleted] = await db.delete(products).where(eq(products.id, id)).returning();
	if (!deleted) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Producto no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	// Limpiar carpeta R2 (no bloqueante, errores se loguean)
	deleteEntityFolder("products", id).catch((err) =>
		logger
			.withMetadata({ entity: "product", id })
			.withError(err)
			.error("[R2 cleanup] Failed to delete folder"),
	);

	return deleted;
}

async function deleteMany(ids: string[]): Promise<BulkDeleteResult> {
	if (ids.length > MAX_BULK_DELETE) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: `No se pueden eliminar más de ${MAX_BULK_DELETE} productos`,
			logLevel: "info",
			doNotLog: true,
		});
	}

	if (new Set(ids).size !== ids.length) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "No se permiten IDs duplicados",
			logLevel: "info",
			doNotLog: true,
		});
	}

	return db
		.transaction(async (tx) => {
			const existing = await tx
				.select({ id: products.id })
				.from(products)
				.where(inArray(products.id, ids));

			const existingIds = existing.map((e) => e.id);
			const notFoundIds = ids.filter((id) => !existingIds.includes(id));

			if (existingIds.length === 0) {
				return { deletedIds: [], notFoundIds, deletedCount: 0 };
			}

			await tx.delete(products).where(inArray(products.id, existingIds));

			return {
				deletedIds: existingIds,
				notFoundIds,
				deletedCount: existingIds.length,
			};
		})
		.then((result) => {
			for (const id of result.deletedIds) {
				deleteEntityFolder("products", id).catch((err) =>
					logger
						.withMetadata({ entity: "product", id })
						.withError(err)
						.error("[R2 cleanup] Failed to delete folder"),
				);
			}
			return result;
		});
}

// ── Product Changes (historial) ───────────────────

/** Product history page + the real total (the page itself is capped at `limit`). */
async function getChanges(productId: string, limit = 200, offset = 0) {
	const [[countRow], changes] = await Promise.all([
		db
			.select({ total: sql<number>`COUNT(*)::int` })
			.from(productChanges)
			.where(eq(productChanges.productId, productId)),
		db
			.select({
				id: productChanges.id,
				syncReportId: productChanges.syncReportId,
				reportTrigger: syncReports.trigger,
				reportStartedAt: syncReports.startedAt,
				changeType: productChanges.changeType,
				field: productChanges.field,
				oldValue: productChanges.oldValue,
				newValue: productChanges.newValue,
				reason: productChanges.reason,
				source: productChanges.source,
				createdAt: productChanges.createdAt,
			})
			.from(productChanges)
			.leftJoin(syncReports, eq(productChanges.syncReportId, syncReports.id))
			.where(eq(productChanges.productId, productId))
			.orderBy(desc(productChanges.createdAt))
			.limit(limit)
			.offset(offset),
	]);

	return { changes, total: countRow?.total ?? 0 };
}

/**
 * True if the error is a tsquery syntax error (SQLSTATE 42601) or invalid text
 * representation (22P02). Using SQLSTATE codes avoids swallowing legitimate DB errors.
 */
function isTsqueryError(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;
	const code = Reflect.get(error, "code");
	return code === "42601" || code === "22P02";
}

/**
 * Search ORDER BY clause. In-stock is the primary sort, then FTS relevance,
 * then SKU prefix match, then id for stable order.
 *
 * Without in-stock as the primary sort, a short product name like
 * "Laptop HP Intel Core i5 1334U" would beat "Laptop HP 250 G10 Core i5 1334U
 * 8GB DDR4 512GB NVMe 15.6\"" on FTS rank (shorter = denser match) and show
 * "Agotado" first — a bad UX since the user is clearly looking for laptops
 * they can buy.
 */
function buildSearchOrder(
	sortBy: string | undefined,
	searchVector: ReturnType<typeof sql.identifier>,
	tsQuery: SQL | null,
	searchTerm: string,
) {
	if (!sortBy || sortBy === "relevance") {
		const clauses: SQL[] = [
			sql`(GREATEST(0, ${products.stock} - COALESCE((${getReservedStockSubquery(products.id)})::int, 0)) > 0) DESC`,
		];
		// Without a valid tsquery (SKU-only fallback) there is no relevance to rank.
		if (tsQuery) clauses.push(sql`ts_rank_cd(${searchVector}, ${tsQuery}) DESC`);
		clauses.push(
			sql`CASE WHEN ${products.sku} ILIKE ${`${escapeLikePattern(searchTerm)}%`} THEN 0 ELSE 1 END`,
			asc(products.id),
		);
		return clauses;
	}

	const entry = isSortByKey(sortBy) ? SORT_MAP[sortBy] : undefined;
	return entry ?? [desc(products.createdAt)];
}

// ═══════════════════════════════════════════════════
//  SEARCH (FTS + SKU prefix)
// ═══════════════════════════════════════════════════

async function search(
	q: string,
	pageLimit: number = 20,
	pageOffset: number = 0,
	brandFilter?: string,
	minPrice?: string,
	maxPrice?: string,
	sortBy?: string,
	role: Role = "customer",
): Promise<{
	data: ProductSearchResult[];
	total: number;
	limit: number;
	offset: number;
	hasMore: boolean;
}> {
	const searchTerm = q.trim();

	// Guard against empty/whitespace-only queries (defense in depth — route also validates)
	if (searchTerm.length < 2) {
		return { data: [], total: 0, limit: pageLimit, offset: pageOffset, hasMore: false };
	}

	// Build a prefix-aware tsquery so "3200" matches "3200MHz", "3200DPI", etc.
	const prefixQuery = buildPrefixTsQuery(searchTerm);
	// Sanitization may strip every token (e.g. "!!!"): with no valid tsquery the
	// search falls back to a SKU prefix match instead of returning nothing, so
	// SKUs holding symbols the FTS tokenizer drops still resolve.
	const tsQuery = prefixQuery ? sql`to_tsquery('spanish', ${prefixQuery})` : null;
	const skuPrefixPattern = `${escapeLikePattern(searchTerm)}%`;

	const start = performance.now();
	// Sanitize the user query for logging: strip control/format chars, redact PII, cap length.
	// This is independent of the SQL-level sanitization (buildPrefixTsQuery / escapeLikePattern).
	const controlCharsRegex =
		// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — strips control chars from user input
		/[\u0000-\u001F\u007F\u0085\u200B-\u200D\u2028\u2029\u202E\u2066-\u2069\uFEFF]/g;
	const safeQuery = searchTerm
		.replace(controlCharsRegex, " ")
		.replace(/\s+/g, " ")
		.trim()
		// Redact common PII shapes before they hit the log
		.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
		.replace(/\+?\d[\d\s-]{7,}/g, "[phone]")
		// Bound log payload size; schema already caps q at 100 chars, this is defense in depth
		.slice(0, SEARCH_PAYLOAD_CAP);

	// search_vector is a GENERATED column from 0001_product_search.sql — not in Drizzle schema
	const searchVector = sql.identifier("search_vector");

	// ── Build WHERE conditions ──
	const matchCondition = tsQuery
		? or(sql`${searchVector} @@ ${tsQuery}`, ilike(products.sku, skuPrefixPattern))
		: ilike(products.sku, skuPrefixPattern);
	const conditions: ReturnType<typeof and>[] = [
		eq(products.isActive, true),
		reviewVisibleCondition,
		matchCondition,
	];

	// Brand filter: resolve comma-separated slugs to IDs
	if (brandFilter) {
		const brandSlugs = brandFilter
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		if (brandSlugs.length > 0) {
			const brandRows = await db
				.select({ id: brands.id })
				.from(brands)
				.where(inArray(brands.slug, brandSlugs));
			if (brandRows.length === 0) {
				return { data: [], total: 0, limit: pageLimit, offset: pageOffset, hasMore: false };
			}
			conditions.push(
				inArray(
					products.brandId,
					brandRows.map((r) => r.id),
				),
			);
		}
	}

	const where = and(...conditions);

	// ── Pagination strategy (same two-route rule as listPublic) ──
	// The effective price is role-aware and offer-aware (JS-only), so a price
	// filter or a price sort cannot ride SQL LIMIT/OFFSET without cutting the
	// wrong window (and COUNT would include rows the filter drops). Fetch the
	// full match set and page in JS then; otherwise SQL LIMIT/OFFSET + COUNT
	// is exact.
	//
	// TODO(perf): materialize the effective price if the catalog grows.
	const priceMin = minPrice ? Number.parseFloat(minPrice) : null;
	const priceMax = maxPrice ? Number.parseFloat(maxPrice) : null;
	const hasPriceFilter = priceMin !== null || priceMax !== null;
	const needsJsPagination = hasPriceFilter || sortBy === "price_asc" || sortBy === "price_desc";

	const selectRows = () =>
		db
			.select({
				id: products.id,
				name: products.name,
				slug: products.slug,
				sku: products.sku,
				supplierPrice: products.supplierPrice,
				roleCustomMargins: products.roleCustomMargins,
				managedBy: products.managedBy,
				price: products.price,
				isFeatured: products.isFeatured,
				stock: sql<number>`GREATEST(0, ${products.stock} - COALESCE((${getReservedStockSubquery(products.id)})::int, 0))`,
				isInStock: sql<boolean>`GREATEST(0, ${products.stock} - COALESCE((${getReservedStockSubquery(products.id)})::int, 0)) > 0`,
				primaryImageUrl: sql<string | null>`(
				SELECT pi.url FROM product_images pi
				WHERE pi.product_id = ${products.id}
				ORDER BY pi.is_primary DESC, pi.sort_order ASC NULLS LAST
				LIMIT 1
			)`,
				primaryImageAlt: sql<string | null>`(
				SELECT pi.alt FROM product_images pi
				WHERE pi.product_id = ${products.id}
				ORDER BY pi.is_primary DESC, pi.sort_order ASC NULLS LAST
				LIMIT 1
			)`,
				brandName: brands.name,
				brandSlug: brands.slug,
				categoryName: categories.name,
				categorySlug: categories.slug,
				headline: tsQuery
					? sql<
							string | null
						>`ts_headline('spanish', ${products.name}, ${tsQuery}, 'MaxFragments=1,MaxWords=15,MinWords=5,StartSel=\u0001,StopSel=\u0002')`
					: sql<string | null>`NULL`,
				offers: activeOffersForProductSubquery(),
			})
			.from(products)
			.leftJoin(brands, eq(products.brandId, brands.id))
			.leftJoin(categories, eq(products.categoryId, categories.id))
			.where(where)
			.orderBy(...buildSearchOrder(sortBy, searchVector, tsQuery, searchTerm));

	// Malformed tsquery (SQLSTATE 42601/22P02) → warn + empty result, as before.
	const runSearchQuery = async () => {
		try {
			return needsJsPagination
				? await selectRows()
				: await selectRows().offset(pageOffset).limit(pageLimit);
		} catch (error) {
			logger
				.withMetadata({
					event: "search.tsquery.malformed",
					query: safeQuery,
					stage: "data",
					durationMs: Math.round(performance.now() - start),
				})
				.warn("search received malformed tsquery input");
			if (isTsqueryError(error)) return null;
			throw error;
		}
	};

	const rawRows = await runSearchQuery();
	if (!rawRows) {
		return { data: [], total: 0, limit: pageLimit, offset: pageOffset, hasMore: false };
	}
	type Row = (typeof rawRows)[number];

	// ── Total ──
	// SQL path: count every match. JS path: exact count after pricing/filtering.
	let total = 0;
	if (!needsJsPagination) {
		try {
			const [countRow] = await db
				.select({ total: count(products.id) })
				.from(products)
				.where(where);
			total = Number(countRow?.total ?? 0);
		} catch (error) {
			logger
				.withMetadata({
					event: "search.tsquery.malformed",
					query: safeQuery,
					stage: "count",
					durationMs: Math.round(performance.now() - start),
				})
				.warn("search received malformed tsquery input");
			if (isTsqueryError(error)) {
				return { data: [], total: 0, limit: pageLimit, offset: pageOffset, hasMore: false };
			}
			throw error;
		}
	}

	const marginRules = await getActiveMarginRules();

	type Enriched = {
		row: Row;
		basePrice: number;
		offerPrice: string | null;
		discountPercent: number;
		effectivePrice: number;
	};

	let enriched: Enriched[] = rawRows.map((row) => {
		const { salePrice, offerPriceStr, discountPercent, effectivePrice } = enrichPublicPricing({
			row,
			role,
			marginRules,
		});
		return {
			row,
			basePrice: salePrice,
			offerPrice: offerPriceStr,
			discountPercent,
			effectivePrice,
		};
	});

	if (needsJsPagination) {
		enriched = enriched.filter(({ effectivePrice }) => {
			if (priceMin !== null && effectivePrice < priceMin) return false;
			if (priceMax !== null && effectivePrice > priceMax) return false;
			return true;
		});

		// Effective-price sort: the stored column can disagree with the
		// offer-aware price. The id tiebreak keeps pages stable.
		if (sortBy === "price_asc") {
			enriched.sort(
				(a, b) => a.effectivePrice - b.effectivePrice || a.row.id.localeCompare(b.row.id),
			);
		} else if (sortBy === "price_desc") {
			enriched.sort(
				(a, b) => b.effectivePrice - a.effectivePrice || a.row.id.localeCompare(b.row.id),
			);
		}

		total = enriched.length;
	}

	// SQL path is already paginated; JS path slices after enriching/filtering.
	const paginated = needsJsPagination
		? enriched.slice(pageOffset, pageOffset + pageLimit)
		: enriched;

	const data = paginated.map(
		({ row, basePrice, offerPrice, discountPercent }): ProductSearchResult => ({
			id: row.id,
			name: row.name,
			slug: row.slug,
			sku: row.sku,
			price: basePrice.toFixed(2),
			offerPrice,
			discountPercent,
			isInStock: row.isInStock,
			isFeatured: row.isFeatured,
			stock: row.stock,
			primaryImage: row.primaryImageUrl
				? { url: row.primaryImageUrl, alt: row.primaryImageAlt }
				: null,
			brand: row.brandName ? { name: row.brandName, slug: row.brandSlug! } : null,
			category: row.categoryName ? { name: row.categoryName, slug: row.categorySlug! } : null,
			headline: row.headline,
			offers: row.offers,
		}),
	);

	const durationMs = Math.round(performance.now() - start);

	// Slow query → warn (actionable: investigate query plan, index, or pagination)
	if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
		logger
			.withMetadata({ event: "search.slow", query: safeQuery, resultCount: total, durationMs })
			.warn("search exceeded 200ms threshold");
	}
	// Zero-result → debug (catalog gap signal; high volume, low urgency).
	// Enable via LOG_LEVEL=debug to investigate.
	if (total === 0) {
		logger
			.withMetadata({ event: "search.empty", query: safeQuery, durationMs })
			.debug("search returned zero results");
	}

	return {
		data,
		total,
		limit: pageLimit,
		offset: pageOffset,
		hasMore: pageOffset + data.length < total,
	};
}

// ── Public API ─────────────────────────────────────

export const ProductService = {
	// Admin
	list,
	getBySlug,
	getById,
	getChanges,
	create,
	update,
	delete: deleteById,
	deleteMany,

	// Public
	listPublic,
	getBySlugPublic,

	// Search
	search,
};
