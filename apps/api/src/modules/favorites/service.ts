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
import { and, desc, eq, inArray, sql } from "drizzle-orm";
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

// ── Helpers ───────────────────────────────────────────

function now(): Date {
	return new Date();
}

function formatDate(date: Date): string {
	return date.toISOString();
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

async function checkFavorite(userId: string, productId: string): Promise<{ isFavorite: boolean }> {
	const favorite = await findByUserId(userId);
	if (!favorite) {
		return { isFavorite: false };
	}

	const [row] = await db
		.select({ id: favoriteItems.id })
		.from(favoriteItems)
		.where(and(eq(favoriteItems.favoriteId, favorite.id), eq(favoriteItems.productId, productId)))
		.limit(1);

	return { isFavorite: !!row };
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

async function getItems(favoriteId: string, filters: ListFilters): Promise<FavoriteListResponse> {
	const offset = filters.offset ?? 0;
	const limit = filters.limit ?? 20;

	// ── Build sub-queries for brand/category joins ──

	// We need LEFT JOINs to brands and categories for filtering
	// Products use brandId (FK → brands.id) and categoryId (FK → categories.id)

	// Brand slugs filter: sub-query approach
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

	// Build WHERE conditions
	const conditions = [eq(favoriteItems.favoriteId, favoriteId)];

	if (brandIdsForFilter && brandIdsForFilter.length > 0) {
		conditions.push(inArray(products.brandId, brandIdsForFilter));
	}

	if (filters.minPrice) {
		conditions.push(sql`${products.price} >= ${filters.minPrice}::numeric`);
	}

	if (filters.maxPrice) {
		conditions.push(sql`${products.price} <= ${filters.maxPrice}::numeric`);
	}

	// Build ORDER BY
	let orderBy = desc(favoriteItems.createdAt); // default: newest first
	if (filters.sortBy === "price_asc") {
		orderBy = sql`${products.price} ASC`;
	} else if (filters.sortBy === "price_desc") {
		orderBy = sql`${products.price} DESC`;
	} else if (filters.sortBy === "name_asc") {
		orderBy = sql`${products.name} ASC`;
	} else if (filters.sortBy === "name_desc") {
		orderBy = sql`${products.name} DESC`;
	}

	// Get total count
	const [countResult] = await db
		.select({
			total: sql<number>`COUNT(*)::int`,
		})
		.from(favoriteItems)
		.innerJoin(products, eq(favoriteItems.productId, products.id))
		.where(and(...conditions));

	const total = countResult?.total ?? 0;

	// Get paginated items with joins (LEFT JOIN for brand/category — they may be null)
	const rows = await db
		.select({
			itemId: favoriteItems.id,
			productId: favoriteItems.productId,
			productName: products.name,
			productSlug: products.slug,
			productSku: products.sku,
			price: sql<string>`${products.price}::text`,
			stock: products.stock,
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
		})
		.from(favoriteItems)
		.innerJoin(products, eq(favoriteItems.productId, products.id))
		.leftJoin(brands, eq(products.brandId, brands.id))
		.leftJoin(categories, eq(products.categoryId, categories.id))
		.where(and(...conditions))
		.orderBy(orderBy)
		.limit(limit)
		.offset(offset);

	const items: FavoriteItemResponse[] = rows.map((row) => ({
		id: row.itemId,
		productId: row.productId,
		productName: row.productName ?? "",
		productSlug: row.productSlug ?? "",
		productSku: row.productSku ?? "",
		price: row.price ?? "0",
		stock: row.stock ?? 0,
		isInStock: (row.stock ?? 0) > 0,
		primaryImage: row.imageUrl ? { url: row.imageUrl, alt: row.imageAlt } : null,
		brand:
			row.brandId && row.brandName
				? { id: row.brandId, name: row.brandName, slug: row.brandSlug ?? row.brandId }
				: null,
		category:
			row.categoryId && row.categoryName
				? { id: row.categoryId, name: row.categoryName, slug: row.categorySlug ?? row.categoryId }
				: null,
		createdAt: formatDate(row.createdAt),
	}));

	// Get brand filter counts for the sidebar
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

	// Enrich brand rows with names and slugs (batched query, not N+1)
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

	const hasMore = offset + limit < total;

	return {
		data: items,
		total,
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
	checkFavorite,
};
