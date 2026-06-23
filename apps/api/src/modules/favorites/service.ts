import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import {
	brands,
	categories,
	favoriteItems,
	favorites,
	productImages,
	products,
} from "@renovabit/db/schema";
import { applyOfferToProduct, getEffectiveSalePrice, type Role } from "@renovabit/pricing";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { formatDate, now } from "@/utils/date";
import { getActiveMarginRules } from "@/utils/margin-rules";
import { getReservedStockSubquery } from "@/utils/stock";
import { activeOffersForProductSubquery } from "../offers/service";
import type {
	AddItemBody,
	FavoriteItemResponse,
	FavoriteListResponse,
	FavoriteResponse,
} from "./model";

// ── Internal Types ────────────────────────────────────

interface ListFilters {
	offset?: number;
	limit?: number;
	sortBy?: string;
	brands?: string;
	minPrice?: string;
	maxPrice?: string;
}

interface BrandCountRow {
	id: string;
	name: string;
	slug: string;
	productCount: number;
}

// ═══════════════════════════════════════════════════
//  INTERNAL HELPERS
// ═══════════════════════════════════════════════════

async function findByUserId(userId: string): Promise<{
	id: string;
	itemsCount: number;
	lastActivityAt: Date;
} | null> {
	const [row] = await db
		.select({
			id: favorites.id,
			itemsCount: favorites.itemsCount,
			lastActivityAt: favorites.lastActivityAt,
		})
		.from(favorites)
		.where(eq(favorites.userId, userId))
		.orderBy(desc(favorites.lastActivityAt))
		.limit(1);
	return row ?? null;
}

async function createFavorite(userId: string): Promise<{ id: string }> {
	const [row] = await db
		.insert(favorites)
		.values({
			userId,
			itemsCount: 0,
			lastActivityAt: now(),
		})
		.onConflictDoNothing()
		.returning({ id: favorites.id });

	if (!row) {
		// Concurrent request beat us — re-fetch
		const existing = await findByUserId(userId);
		if (existing) return { id: existing.id };

		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al crear la lista de favoritos",
		});
	}

	return { id: row.id };
}

async function syncSummary(favoriteId: string): Promise<void> {
	const [row] = await db
		.select({
			itemsCount: sql<number>`COUNT(*)::int`,
		})
		.from(favoriteItems)
		.where(eq(favoriteItems.favoriteId, favoriteId));

	await db
		.update(favorites)
		.set({
			itemsCount: row?.itemsCount ?? 0,
			lastActivityAt: now(),
		})
		.where(eq(favorites.id, favoriteId));
}

// ═══════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════

async function getStatusesForProducts(
	userId: string,
	productIds: ReadonlyArray<string>,
): Promise<Record<string, boolean>> {
	const result: Record<string, boolean> = {};
	for (const id of productIds) result[id] = false;

	if (productIds.length === 0) return result;

	const favorite = await findByUserId(userId);
	if (!favorite) return result;

	const rows = await db
		.select({ productId: favoriteItems.productId })
		.from(favoriteItems)
		.where(
			and(
				eq(favoriteItems.favoriteId, favorite.id),
				inArray(favoriteItems.productId, [...productIds]),
			),
		);

	for (const row of rows) {
		result[row.productId] = true;
	}
	return result;
}

async function getOrCreate(userId: string): Promise<{ id: string }> {
	const existing = await findByUserId(userId);

	if (existing) {
		return { id: existing.id };
	}

	return createFavorite(userId);
}

async function addItem(favoriteId: string, data: AddItemBody): Promise<FavoriteResponse> {
	// Validate product exists
	const [product] = await db
		.select({ id: products.id })
		.from(products)
		.where(eq(products.id, data.productId))
		.limit(1);

	if (!product) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Producto no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	// Idempotent insert
	await db
		.insert(favoriteItems)
		.values({ favoriteId, productId: data.productId })
		.onConflictDoNothing();

	await syncSummary(favoriteId);

	return getById(favoriteId);
}

async function removeItem(favoriteId: string, productId: string): Promise<FavoriteResponse> {
	const deleted = await db
		.delete(favoriteItems)
		.where(and(eq(favoriteItems.favoriteId, favoriteId), eq(favoriteItems.productId, productId)))
		.returning({ id: favoriteItems.id });

	if (deleted.length > 0) {
		await syncSummary(favoriteId);
	}

	return getById(favoriteId);
}

async function getItems(
	favoriteId: string,
	role: Role,
	filters: ListFilters,
): Promise<FavoriteListResponse> {
	const offset = filters.offset ?? 0;
	const limit = filters.limit ?? 20;

	// ── Brand slugs filter (resolved once, not N+1) ──
	let brandIdsForFilter: string[] | null = null;
	if (filters.brands) {
		const brandSlugs = filters.brands
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		if (brandSlugs.length > 0) {
			const brandRows = await db
				.select({ id: brands.id })
				.from(brands)
				.where(inArray(brands.slug, brandSlugs));
			brandIdsForFilter = brandRows.map((r) => r.id).filter(Boolean);
		}
	}

	// ── Build WHERE conditions (no price filter here — applied in JS post-pricing) ──
	const conditions = [eq(favoriteItems.favoriteId, favoriteId)];

	if (brandIdsForFilter && brandIdsForFilter.length > 0) {
		conditions.push(inArray(products.brandId, brandIdsForFilter));
	}

	// Default ORDER BY (newest first); price/name sorts are applied in JS post-pricing.
	const orderBy = desc(favoriteItems.createdAt);

	// Count is the pre-filter, pre-sort total (brand-filter only). The displayed
	// `total` reflects the post price-filter + post-sort count.
	const [countResult] = await db
		.select({
			total: sql<number>`COUNT(*)::int`,
		})
		.from(favoriteItems)
		.innerJoin(products, eq(favoriteItems.productId, products.id))
		.where(and(...conditions));

	const total = countResult?.total ?? 0;

	// Fetch the page (over-fetch when price filter is active so the JS filter
	// still returns a full page, same pattern as products listPublic).
	const priceMin = filters.minPrice ? Number.parseFloat(filters.minPrice) : null;
	const priceMax = filters.maxPrice ? Number.parseFloat(filters.maxPrice) : null;
	const hasPriceFilter = priceMin !== null || priceMax !== null;
	const fetchLimit = hasPriceFilter ? Math.max(limit, 100) : limit;

	const rows = await db
		.select({
			itemId: favoriteItems.id,
			productId: favoriteItems.productId,
			productName: products.name,
			productSlug: products.slug,
			productSku: products.sku,
			isFeatured: products.isFeatured,
			stock: sql<number>`GREATEST(0, ${products.stock} - COALESCE((${getReservedStockSubquery(products.id)})::int, 0))`,
			supplierPrice: products.supplierPrice,
			roleCustomMargins: products.roleCustomMargins,
			brandId: products.brandId,
			brandName: brands.name,
			brandSlug: brands.slug,
			categoryId: products.categoryId,
			categoryName: categories.name,
			categorySlug: categories.slug,
			imageUrl: sql<string | null>`(
				SELECT pi.url FROM ${productImages} pi
				WHERE pi.product_id = ${products.id}
				ORDER BY pi.is_primary DESC, pi.sort_order ASC NULLS LAST
				LIMIT 1
			)`,
			imageAlt: sql<string | null>`(
				SELECT pi.alt FROM ${productImages} pi
				WHERE pi.product_id = ${products.id}
				ORDER BY pi.is_primary DESC, pi.sort_order ASC NULLS LAST
				LIMIT 1
			)`,
			createdAt: favoriteItems.createdAt,
			offers: activeOffersForProductSubquery(),
		})
		.from(favoriteItems)
		.innerJoin(products, eq(favoriteItems.productId, products.id))
		.leftJoin(brands, eq(products.brandId, brands.id))
		.leftJoin(categories, eq(products.categoryId, categories.id))
		.where(and(...conditions))
		.orderBy(orderBy)
		.limit(fetchLimit);

	// ── Role-aware pricing + JS price filter ──
	const marginRules = await getActiveMarginRules();

	type Enriched = {
		row: (typeof rows)[number];
		basePrice: number;
		offerPrice: number | null;
		discountPercent: number;
		effectivePrice: number;
	};

	const enriched: Enriched[] = rows.map((row) => {
		const { salePrice } = getEffectiveSalePrice(
			{ supplierPrice: row.supplierPrice, roleCustomMargins: row.roleCustomMargins },
			role,
			marginRules,
		);
		const offerInputs = row.offers.map((o) => ({
			id: o.id,
			discountValue: Number.parseFloat(o.discountValue) || 0,
		}));
		const offerResult = applyOfferToProduct(salePrice, offerInputs, role);
		const discountPercent =
			salePrice > 0 ? Math.round(((salePrice - offerResult.discountedPrice) / salePrice) * 100) : 0;
		return {
			row,
			basePrice: salePrice,
			offerPrice: offerResult.discountedPrice < salePrice ? offerResult.discountedPrice : null,
			discountPercent,
			effectivePrice: offerResult.discountedPrice,
		};
	});

	const priceFiltered = enriched.filter(({ effectivePrice }) => {
		if (priceMin !== null && effectivePrice < priceMin) return false;
		if (priceMax !== null && effectivePrice > priceMax) return false;
		return true;
	});

	// ── Apply sort post-pricing (only for price/name; default already handled) ──
	const sortBy = filters.sortBy;
	if (sortBy === "price_asc") {
		priceFiltered.sort((a, b) => a.effectivePrice - b.effectivePrice);
	} else if (sortBy === "price_desc") {
		priceFiltered.sort((a, b) => b.effectivePrice - a.effectivePrice);
	} else if (sortBy === "name_asc") {
		priceFiltered.sort((a, b) => a.row.productName.localeCompare(b.row.productName));
	} else if (sortBy === "name_desc") {
		priceFiltered.sort((a, b) => b.row.productName.localeCompare(a.row.productName));
	}

	// ── Paginate post-filter ──
	const effectiveTotal = hasPriceFilter ? priceFiltered.length + offset : total;
	const paginated = priceFiltered.slice(0, limit);
	const hasMore = offset + paginated.length < effectiveTotal;

	const items: FavoriteItemResponse[] = paginated.map(
		({ row, basePrice, offerPrice, discountPercent }) => ({
			id: row.itemId,
			productId: row.productId,
			productName: row.productName ?? "",
			productSlug: row.productSlug ?? "",
			productSku: row.productSku ?? "",
			basePrice: basePrice.toFixed(2),
			offerPrice: offerPrice !== null ? offerPrice.toFixed(2) : null,
			discountPercent,
			isFeatured: row.isFeatured ?? false,
			stock: row.stock ?? 0,
			isInStock: (row.stock ?? 0) > 0,
			primaryImage: row.imageUrl ? { url: row.imageUrl, alt: row.imageAlt } : null,
			brand:
				row.brandId && row.brandName
					? { id: row.brandId, name: row.brandName, slug: row.brandSlug ?? row.brandId }
					: null,
			category:
				row.categoryId && row.categoryName
					? {
							id: row.categoryId,
							name: row.categoryName,
							slug: row.categorySlug ?? row.categoryId,
						}
					: null,
			createdAt: formatDate(row.createdAt),
		}),
	);

	// ── Brand filter counts (sidebar) — use pre-price-filter total so the
	//    brand facet stays stable when the user narrows by price. ──
	const brandCountRows = await db
		.select({
			brandId: products.brandId,
			count: sql<number>`COUNT(*)::int`,
		})
		.from(favoriteItems)
		.innerJoin(products, eq(favoriteItems.productId, products.id))
		.where(eq(favoriteItems.favoriteId, favoriteId))
		.groupBy(products.brandId)
		.orderBy(desc(sql`COUNT(*)::int`));

	const brandIds = brandCountRows.map((br) => br.brandId).filter((id): id is string => id !== null);
	const brandRows =
		brandIds.length > 0
			? await db
					.select({ id: brands.id, name: brands.name, slug: brands.slug })
					.from(brands)
					.where(inArray(brands.id, brandIds))
			: [];
	const brandMap = new Map(brandRows.map((b) => [b.id, b]));

	const brandCounts: BrandCountRow[] = [];
	for (const br of brandCountRows) {
		if (br.brandId) {
			const b = brandMap.get(br.brandId);
			if (b) {
				brandCounts.push({
					id: br.brandId,
					name: b.name,
					slug: b.slug,
					productCount: br.count,
				});
			}
		}
	}

	return {
		data: items,
		total: effectiveTotal,
		offset,
		limit,
		hasMore,
		brands: brandCounts,
	};
}

async function getById(favoriteId: string): Promise<FavoriteResponse> {
	const [row] = await db
		.select({
			id: favorites.id,
			itemsCount: favorites.itemsCount,
			lastActivityAt: favorites.lastActivityAt,
		})
		.from(favorites)
		.where(eq(favorites.id, favoriteId))
		.limit(1);

	if (!row) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Lista de favoritos no encontrada",
			logLevel: "info",
			doNotLog: true,
		});
	}

	return {
		id: row.id,
		itemsCount: row.itemsCount,
		lastActivityAt: formatDate(row.lastActivityAt),
	};
}

// ═══════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════

export const FavoritesService = {
	getOrCreate,
	addItem,
	removeItem,
	getItems,
	getById,
	getStatusesForProducts,
};
