import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import {
	brands,
	categories,
	productChanges,
	products,
	type RoleCustomMargins,
	syncReports,
} from "@renovabit/db/schema";
import {
	applyOfferToProduct,
	getEffectiveSalePrice,
	type OfferInput,
	type Role,
} from "@renovabit/pricing";
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
	sql,
} from "drizzle-orm";
import { MAX_BULK_DELETE, SEARCH_PAYLOAD_CAP, SLOW_QUERY_THRESHOLD_MS } from "@/constants";
import { getCategoryAndDescendantIds } from "@/utils/category-helpers";
import { handleUniqueViolation, makeSlug } from "@/utils/db-helpers";
import { logger } from "@/utils/logger";
import { getActiveMarginRules } from "@/utils/margin-rules";
import { buildPrefixTsQuery, escapeLikePattern } from "@/utils/prefix-tsquery";
import { getReservedStockSubquery } from "@/utils/stock";
import { deleteEntityFolder } from "@/utils/storage/helpers";
import { type ActiveOfferRef, activeOffersForProductSubquery } from "../offers/service";
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
};

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
	eq(products.needsReview, false),
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
	// not the buyer's role price, so SQL-level filtering would be wrong for admin/distributor views.

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
	return db
		.select({
			...getTableColumns(products),
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
}

async function getBySlug(slug: string): Promise<Product | null> {
	const [row] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
	return row ?? null;
}

async function getById(id: string): Promise<Product | null> {
	const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
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

/**
 * Computes offer price enrichment for a single product row.
 * Returns null offerPrice and 0 discount when no offer applies or role is admin.
 * Role-aware: admin sees null/0, customer sees computed offer, distributor sees min(tier, offer).
 */
function computeOfferEnrichment(
	salePrice: number,
	offers: ActiveOfferRef[],
	role: Role,
): { offerPrice: string | null; discountPercent: number } {
	if (role === "admin" || !offers.length) {
		return { offerPrice: null, discountPercent: 0 };
	}

	const offerInputs: OfferInput[] = offers.map((o) => ({
		id: o.id,
		discountValue: Number.parseFloat(o.discountValue) || 0,
	}));

	const result = applyOfferToProduct(salePrice, offerInputs, role);

	const discountPercent =
		salePrice > 0 ? Math.round(((salePrice - result.discountedPrice) / salePrice) * 100) : 0;

	return {
		offerPrice: result.discountedPrice < salePrice ? result.discountedPrice.toFixed(2) : null,
		discountPercent,
	};
}

async function listPublic(
	options: ListOptions = {},
): Promise<{ data: PublicProductListItem[]; total: number; offset: number; limit: number }> {
	// ── Resolve slugs → IDs (agregación de descendientes para categorías) ──
	let categoryIds: string[] | undefined;
	if (options.categorySlug) {
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

	// ── Count total ──
	const [countRow] = await db
		.select({ total: count(products.id) })
		.from(products)
		.where(where);

	const total = Number(countRow?.total ?? 0);
	const offset = resolvedOptions.offset ?? 0;
	const limit = resolvedOptions.limit ?? 20;

	// ── Query paginada ──
	const rows = await db
		.select({
			id: products.id,
			name: products.name,
			slug: products.slug,
			supplierPrice: products.supplierPrice,
			roleCustomMargins: products.roleCustomMargins,
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
		.orderBy(...buildOrderBy(resolvedOptions.sortBy))
		.offset(offset)
		.limit(limit);

	const marginRules = await getActiveMarginRules();
	const role: Role = resolvedOptions.role ?? "customer";

	// Filter by role-specific price (post-filter in JS, not SQL — role-aware
	// pricing can't be expressed in a single SQL WHERE clause)
	const filteredByMin = options.minPrice ? Number(options.minPrice) : null;
	const filteredByMax = options.maxPrice ? Number(options.maxPrice) : null;

	const data = rows
		.map((row) => {
			const { salePrice } = getEffectiveSalePrice(
				{
					supplierPrice: row.supplierPrice,
					roleCustomMargins: row.roleCustomMargins,
				},
				role,
				marginRules,
			);
			const { offerPrice, discountPercent } = computeOfferEnrichment(salePrice, row.offers, role);
			return {
				id: row.id,
				name: row.name,
				slug: row.slug,
				price: salePrice.toFixed(2),
				priceValue: salePrice,
				offerPrice,
				discountPercent,
				stock: row.stock,
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
			};
		})
		.filter((row) => {
			if (filteredByMin !== null && row.priceValue < filteredByMin) return false;
			if (filteredByMax !== null && row.priceValue > filteredByMax) return false;
			return true;
		})
		.map(({ priceValue: _pv, ...rest }) => rest);

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
	const { salePrice } = getEffectiveSalePrice(
		{
			supplierPrice: row.supplierPrice,
			roleCustomMargins: row.roleCustomMargins,
		},
		role,
		marginRules,
	);

	const { offerPrice, discountPercent } = computeOfferEnrichment(salePrice, row.offers, role);

	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		description: row.description,
		price: salePrice.toFixed(2),
		offerPrice,
		discountPercent,
		stock: row.stock,
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

	// Always derive `price` from supplierPrice + customer margin; ignore any value sent in the body.
	const supplierPrice = data.supplierPrice ?? "0";
	const marginRules = await getActiveMarginRules();
	const { salePrice } = getEffectiveSalePrice(
		{ supplierPrice, roleCustomMargins: data.roleCustomMargins ?? null },
		"customer",
		marginRules,
	);

	const [item] = await db
		.insert(products)
		.values({
			name: nextName,
			slug: nextSlug,
			description: data.description,
			price: salePrice.toFixed(2),
			sku: data.sku,
			stock: data.stock,
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

	// Recompute `price` whenever pricing inputs change. `price` is NOT accepted
	// from the body — it's always derived.
	const pricingTouched = patch.supplierPrice !== undefined || patch.roleCustomMargins !== undefined;
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

	// Drop fields that are not columns / are auto-computed.
	const { price: _p, supplierPrice: _sp, ...rest } = data;
	const baseUpdate = {
		...rest,
		...patch,
		...(computedPrice !== undefined ? { price: computedPrice } : {}),
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

	return item;
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

async function getChanges(productId: string, limit = 200, offset = 0) {
	return db
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
		.offset(offset);
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
	tsQuery: ReturnType<typeof sql>,
	searchTerm: string,
) {
	if (!sortBy || sortBy === "relevance") {
		return [
			sql`(GREATEST(0, ${products.stock} - COALESCE((${getReservedStockSubquery(products.id)})::int, 0)) > 0) DESC`,
			sql`ts_rank_cd(${searchVector}, ${tsQuery}) DESC`,
			sql`CASE WHEN ${products.sku} ILIKE ${`${escapeLikePattern(searchTerm)}%`} THEN 0 ELSE 1 END`,
			asc(products.id),
		];
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
	if (!prefixQuery) {
		// All tokens stripped by sanitization — no FTS to run, fall through to SKU only
		return { data: [], total: 0, limit: pageLimit, offset: pageOffset, hasMore: false };
	}

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

	const tsQuery = sql`to_tsquery('spanish', ${prefixQuery})`;

	// search_vector is a GENERATED column from 0001_product_search.sql — not in Drizzle schema
	const searchVector = sql.identifier("search_vector");

	// ── Build WHERE conditions ──
	const conditions: ReturnType<typeof and>[] = [
		eq(products.isActive, true),
		eq(products.needsReview, false),
		or(
			sql`${searchVector} @@ ${tsQuery}`,
			ilike(products.sku, `${escapeLikePattern(searchTerm)}%`),
		),
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

	// ── Count total ──
	let total = 0;
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

	// ── Query paginada ──
	let rows: Array<{
		id: string;
		name: string;
		slug: string;
		sku: string;
		supplierPrice: string;
		roleCustomMargins: RoleCustomMargins | null;
		isFeatured: boolean;
		stock: number;
		isInStock: boolean;
		primaryImageUrl: string | null;
		primaryImageAlt: string | null;
		brandName: string | null;
		brandSlug: string | null;
		categoryName: string | null;
		categorySlug: string | null;
		headline: string | null;
		offers: Array<{
			id: string;
			name: string;
			slug: string;
			discountValue: string;
			isFeatured: boolean;
			endsAt: Date;
		}>;
	}> = [];

	try {
		rows = await db
			.select({
				id: products.id,
				name: products.name,
				slug: products.slug,
				sku: products.sku,
				supplierPrice: products.supplierPrice,
				roleCustomMargins: products.roleCustomMargins,
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
				headline: sql<
					string | null
				>`ts_headline('spanish', ${products.name}, ${tsQuery}, 'MaxFragments=1,MaxWords=15,MinWords=5,StartSel=\u0001,StopSel=\u0002')`,
				offers: activeOffersForProductSubquery(),
			})
			.from(products)
			.leftJoin(brands, eq(products.brandId, brands.id))
			.leftJoin(categories, eq(products.categoryId, categories.id))
			.where(where)
			.orderBy(...buildSearchOrder(sortBy, searchVector, tsQuery, searchTerm))
			.offset(pageOffset)
			.limit(pageLimit);
	} catch (error) {
		logger
			.withMetadata({
				event: "search.tsquery.malformed",
				query: safeQuery,
				stage: "data",
				durationMs: Math.round(performance.now() - start),
			})
			.warn("search received malformed tsquery input");
		if (isTsqueryError(error)) {
			return { data: [], total: 0, limit: pageLimit, offset: pageOffset, hasMore: false };
		}
		throw error;
	}

	const marginRules = await getActiveMarginRules();
	const data = rows.map((row): ProductSearchResult => {
		const { salePrice } = getEffectiveSalePrice(
			{
				supplierPrice: row.supplierPrice,
				roleCustomMargins: row.roleCustomMargins,
			},
			role,
			marginRules,
		);
		const { offerPrice, discountPercent } = computeOfferEnrichment(salePrice, row.offers, role);
		return {
			id: row.id,
			name: row.name,
			slug: row.slug,
			sku: row.sku,
			price: salePrice.toFixed(2),
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
		};
	});

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
