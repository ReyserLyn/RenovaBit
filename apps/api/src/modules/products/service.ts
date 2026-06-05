import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import type { ProductSpecification } from "@renovabit/db/schema";
import { brands, categories, productChanges, products, syncReports } from "@renovabit/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { and, desc, eq, getTableColumns, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { handleUniqueViolation, makeSlug } from "@/utils/db-helpers";
import { deleteEntityFolder } from "@/utils/storage/helpers";
import type {
	BulkDeleteResult,
	ProductModel,
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
};

type ListOptions = {
	brandId?: string;
	categoryId?: string;
	isFeatured?: boolean;
	search?: string;
};

type CreateBody = ProductModel["createBody"];
type UpdateBody = ProductModel["updateBody"];

// ── Constants ──────────────────────────────────────

const MAX_BULK_DELETE = 50;

const PUBLIC_CONDITIONS = [eq(products.isActive, true), eq(products.needsReview, false)] as const;

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

async function ensureUniqueName(name: string, excludeId?: string): Promise<void> {
	const conditions = [eq(products.name, name)];
	if (excludeId) conditions.push(ne(products.id, excludeId));
	const [existing] = await db
		.select({ id: products.id })
		.from(products)
		.where(conditions.length === 1 ? conditions[0] : and(...conditions))
		.limit(1);
	if (existing) {
		throw createApiError({
			code: BackendErrorCodes.EXISTS_ERROR,
			message: "Ya existe un producto con este nombre",
			logLevel: "info",
			doNotLog: true,
		});
	}
}

async function ensureUniqueSlug(slug: string, excludeId?: string): Promise<void> {
	const conditions = [eq(products.slug, slug)];
	if (excludeId) conditions.push(ne(products.id, excludeId));
	const [existing] = await db
		.select({ id: products.id })
		.from(products)
		.where(conditions.length === 1 ? conditions[0] : and(...conditions))
		.limit(1);
	if (existing) {
		throw createApiError({
			code: BackendErrorCodes.EXISTS_ERROR,
			message: "Ya existe un producto con este slug",
			logLevel: "info",
			doNotLog: true,
		});
	}
}

async function ensureUniqueSku(sku: string, excludeId?: string): Promise<void> {
	const conditions = [eq(products.sku, sku)];
	if (excludeId) conditions.push(ne(products.id, excludeId));
	const [existing] = await db
		.select({ id: products.id })
		.from(products)
		.where(conditions.length === 1 ? conditions[0] : and(...conditions))
		.limit(1);
	if (existing) {
		throw createApiError({
			code: BackendErrorCodes.EXISTS_ERROR,
			message: "Ya existe un producto con este SKU",
			logLevel: "info",
			doNotLog: true,
		});
	}
}

// ── Where clause builder ───────────────────────────

function buildWhere(options: ListOptions, isPublic: boolean) {
	const conditions = [];

	if (isPublic) {
		conditions.push(...PUBLIC_CONDITIONS);
	}

	if (options.brandId) conditions.push(eq(products.brandId, options.brandId));
	if (options.categoryId) conditions.push(eq(products.categoryId, options.categoryId));
	if (options.isFeatured !== undefined)
		conditions.push(eq(products.isFeatured, options.isFeatured));
	if (options.search) {
		const term = `%${options.search}%`;
		conditions.push(or(ilike(products.name, term), ilike(products.sku, term)) ?? undefined);
	}

	return conditions.length === 0 ? undefined : and(...conditions);
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

async function listPublic(options: ListOptions = {}): Promise<PublicProductListItem[]> {
	const rows = await db
		.select({
			id: products.id,
			name: products.name,
			slug: products.slug,
			price: sql<string>`${products.price}::text`,
			stock: products.stock,
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
		})
		.from(products)
		.leftJoin(brands, eq(products.brandId, brands.id))
		.leftJoin(categories, eq(products.categoryId, categories.id))
		.where(buildWhere(options, true))
		.orderBy(desc(products.createdAt));

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		slug: row.slug,
		price: row.price,
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
	}));
}

async function getBySlugPublic(slug: string): Promise<PublicProductDetail | null> {
	const [row] = await db
		.select({
			id: products.id,
			name: products.name,
			slug: products.slug,
			description: products.description,
			price: sql<string>`${products.price}::text`,
			stock: products.stock,
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
		})
		.from(products)
		.leftJoin(brands, eq(products.brandId, brands.id))
		.leftJoin(categories, eq(products.categoryId, categories.id))
		.where(and(eq(products.slug, slug), ...PUBLIC_CONDITIONS))
		.limit(1);

	if (!row) return null;

	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		description: row.description,
		price: row.price,
		stock: row.stock,
		sku: row.sku,
		specifications: (row.specifications ?? []) as ProductSpecification[],
		images: row.images,
		brand: row.brandId
			? { id: row.brandId, name: row.brandName!, slug: row.brandSlug!, imageUrl: row.brandImageUrl }
			: null,
		category: row.categoryId
			? { id: row.categoryId, name: row.categoryName!, slug: row.categorySlug! }
			: null,
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

	await ensureUniqueName(nextName);
	await ensureUniqueSlug(nextSlug);
	await ensureUniqueSku(data.sku);
	await ensureBrandExists(data.brandId);
	await ensureCategoryExists(data.categoryId);

	const [item] = await db
		.insert(products)
		.values({
			...data,
			name: nextName,
			slug: nextSlug,
			createdBy: userId,
			updatedBy: userId,
		} as typeof data & { slug: string })
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

	if (nextName !== current.name) await ensureUniqueName(nextName, id);
	if (nextSlug !== current.slug) await ensureUniqueSlug(nextSlug, id);
	if (data.sku && data.sku !== current.sku) await ensureUniqueSku(data.sku, id);

	if (data.brandId !== undefined) await ensureBrandExists(data.brandId);
	if (data.categoryId !== undefined) await ensureCategoryExists(data.categoryId);

	const baseUpdate = { ...data, name: nextName, slug: nextSlug, updatedBy: userId };

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

	// Limpiar carpeta R2 (no bloqueante, imágenes de producto)
	deleteEntityFolder("products", id);

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
			result.deletedIds.forEach((id) => deleteEntityFolder("products", id));
			return result;
		});
}

// ── Product Changes (historial) ───────────────────

async function getChanges(productId: string) {
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
		.orderBy(desc(productChanges.createdAt));
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
};
