import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { brands, categories, products } from "@renovabit/db/schema";
import { and, asc, count, desc, eq, ilike, inArray, like, or, sql } from "drizzle-orm";
import { handleUniqueViolation, makeSlug } from "@/utils/db-helpers";
import { logger } from "@/utils/logger";
import { buildPrefixTsQuery, escapeLikePattern } from "@/utils/prefix-tsquery";
import { getReservedStockSubquery } from "@/utils/stock";
import { deleteEntityFolder, deleteEntityImage, resolveEntityImage } from "@/utils/storage/helpers";
import type { BrandModel, PublicBrandDetail, PublicBrandListItem } from "./model";

type CreateBody = BrandModel["createBody"];
type UpdateBody = BrandModel["updateBody"];

const MAX_BULK_DELETE = 50;
const PUBLIC_PRODUCT_CONDITIONS = [
	eq(products.isActive, true),
	eq(products.needsReview, false),
	sql`GREATEST(0, ${products.stock} - COALESCE((${getReservedStockSubquery(products.id)})::int, 0)) > 0`,
] as const;

// ═══════════════════════════════════════════════════
//  ADMIN QUERIES
// ═══════════════════════════════════════════════════

async function listAdmin(filters?: { isActive?: boolean }) {
	return db
		.select()
		.from(brands)
		.where(filters?.isActive !== undefined ? eq(brands.isActive, filters.isActive) : undefined)
		.orderBy(desc(brands.createdAt));
}

async function getBySlugAdmin(slug: string) {
	const [row] = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1);
	return row ?? null;
}

async function getByIdAdmin(id: string) {
	const [row] = await db.select().from(brands).where(eq(brands.id, id)).limit(1);
	return row ?? null;
}

// ═══════════════════════════════════════════════════
//  PUBLIC QUERIES
// ═══════════════════════════════════════════════════

async function listPublic(
	categorySlug?: string,
	searchTerm?: string,
): Promise<PublicBrandListItem[]> {
	const productConditions = [...PUBLIC_PRODUCT_CONDITIONS];
	const useCategoryFilter = !!categorySlug;
	const useSearchFilter = !!searchTerm;
	const searchVector = sql.identifier("search_vector");

	if (categorySlug) {
		const [category] = await db
			.select({ id: categories.id, path: categories.path })
			.from(categories)
			.where(and(eq(categories.slug, categorySlug), eq(categories.isActive, true)))
			.limit(1);

		if (!category) return [];

		const pathPrefix = `${category.path ?? "/"}${category.id}/`;

		const descendants = await db
			.select({ id: categories.id })
			.from(categories)
			.where(and(like(categories.path, `${pathPrefix}%`), eq(categories.isActive, true)));

		const categoryIds = [category.id, ...descendants.map((d) => d.id)];
		productConditions.push(inArray(products.categoryId, categoryIds));
	}

	if (searchTerm) {
		const prefixQuery = buildPrefixTsQuery(searchTerm);
		if (prefixQuery) {
			const tsQuery = sql`to_tsquery('spanish', ${prefixQuery})`;
			const ftsCondition = or(
				sql`${searchVector} @@ ${tsQuery}`,
				ilike(products.sku, `${escapeLikePattern(searchTerm)}%`),
			);
			// or() returns SQL<unknown> | undefined; if it's undefined (e.g., no
			// conditions), skip pushing to avoid type mismatch with the readonly array
			if (ftsCondition) {
				productConditions.push(ftsCondition);
			}
		}
	}

	const rows = await db
		.select({
			id: brands.id,
			name: brands.name,
			slug: brands.slug,
			imageUrl: brands.imageUrl,
			productCount: count(products.id).mapWith(Number),
		})
		.from(brands)
		.leftJoin(products, and(eq(products.brandId, brands.id), ...productConditions))
		.where(eq(brands.isActive, true))
		.groupBy(brands.id)
		.having(useCategoryFilter || useSearchFilter ? sql`count(${products.id}) > 0` : undefined)
		.orderBy(
			useSearchFilter ? desc(sql`count(${products.id})`) : asc(brands.name),
			asc(brands.name),
		);

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		slug: row.slug,
		imageUrl: row.imageUrl,
		productCount: row.productCount,
	}));
}

async function getBySlugPublic(slug: string): Promise<PublicBrandDetail | null> {
	const [brand] = await db
		.select()
		.from(brands)
		.where(and(eq(brands.slug, slug), eq(brands.isActive, true)))
		.limit(1);

	if (!brand) return null;

	const [row] = await db
		.select({ cnt: count(products.id) })
		.from(products)
		.where(and(eq(products.brandId, brand.id), ...PUBLIC_PRODUCT_CONDITIONS));

	return {
		id: brand.id,
		name: brand.name,
		slug: brand.slug,
		description: brand.description,
		imageUrl: brand.imageUrl,
		productCount: Number(row?.cnt ?? 0),
	};
}

// ═══════════════════════════════════════════════════
//  CREATE / UPDATE / DELETE (admin)
// ═══════════════════════════════════════════════════

async function create(data: CreateBody, userId: string) {
	const nextName = data.name.trim();
	const slug = data.slug?.trim() ? makeSlug(data.slug) : makeSlug(nextName);

	const nameExists = await db
		.select({ id: brands.id })
		.from(brands)
		.where(eq(brands.name, nextName))
		.limit(1);

	if (nameExists.length > 0) {
		throw createApiError({
			code: BackendErrorCodes.EXISTS_ERROR,
			message: "Ya existe una marca con este nombre",
			logLevel: "info",
			doNotLog: true,
		});
	}

	const slugExists = await db
		.select({ id: brands.id })
		.from(brands)
		.where(eq(brands.slug, slug))
		.limit(1);

	if (slugExists.length > 0) {
		throw createApiError({
			code: BackendErrorCodes.EXISTS_ERROR,
			message: "Ya existe una marca con este slug",
			logLevel: "info",
			doNotLog: true,
		});
	}

	const [item] = await db
		.insert(brands)
		.values({
			...data,
			name: nextName,
			slug,
			createdBy: userId,
			updatedBy: userId,
		} as typeof data & {
			slug: string;
		})
		.returning()
		.catch((err) => handleUniqueViolation(err, "Ya existe una marca con este nombre o slug"));

	if (!item) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al crear la marca",
		});
	}

	// Resolver imagen pendiente → permanente
	if (item.imageUrl) {
		const permanentUrl = await resolveEntityImage(item.imageUrl, "brands", item.id);
		if (permanentUrl && permanentUrl !== item.imageUrl) {
			await db.update(brands).set({ imageUrl: permanentUrl }).where(eq(brands.id, item.id));
			item.imageUrl = permanentUrl;
		}
	}

	return item;
}

// ── Update ─────────────────────────────────────────

async function update(id: string, data: UpdateBody, userId: string) {
	const existingRow = await getByIdAdmin(id);
	if (!existingRow) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Marca no encontrada",
			logLevel: "info",
			doNotLog: true,
		});
	}

	// Si cambia el nombre, verificamos que no exista otro
	if (data.name && data.name !== existingRow.name) {
		const dup = await db
			.select({ id: brands.id })
			.from(brands)
			.where(eq(brands.name, data.name))
			.limit(1);

		if (dup.length > 0) {
			throw createApiError({
				code: BackendErrorCodes.EXISTS_ERROR,
				message: "Ya existe una marca con este nombre",
				logLevel: "info",
				doNotLog: true,
			});
		}
	}

	// Normalizar slug
	const nextSlug = data.slug ? makeSlug(data.slug) : existingRow.slug;

	// Si cambia el slug, verificamos que no exista otro
	if (nextSlug !== existingRow.slug) {
		const dup = await db
			.select({ id: brands.id })
			.from(brands)
			.where(eq(brands.slug, nextSlug))
			.limit(1);

		if (dup.length > 0) {
			throw createApiError({
				code: BackendErrorCodes.EXISTS_ERROR,
				message: "Ya existe una marca con este slug",
				logLevel: "info",
				doNotLog: true,
			});
		}
	}

	const [item] = await db
		.update(brands)
		.set({ ...data, slug: nextSlug, updatedBy: userId })
		.where(eq(brands.id, id))
		.returning()
		.catch((err) => handleUniqueViolation(err, "Ya existe una marca con este nombre o slug"));

	if (!item) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al actualizar la marca",
		});
	}

	// 1. Resolver nueva imagen pendiente → permanente (ANTES de eliminar la vieja)
	if (item.imageUrl) {
		const permanentUrl = await resolveEntityImage(item.imageUrl, "brands", item.id);
		if (permanentUrl && permanentUrl !== item.imageUrl) {
			await db.update(brands).set({ imageUrl: permanentUrl }).where(eq(brands.id, item.id));
			item.imageUrl = permanentUrl;
		}
	}

	// 2. Eliminar la imagen anterior SOLO si la nueva se resolvió correctamente
	if (data.imageUrl !== undefined && data.imageUrl !== existingRow.imageUrl) {
		await deleteEntityImage(existingRow.imageUrl);
	}

	return item;
}

// ── Delete ─────────────────────────────────────────

async function deleteBrand(id: string) {
	const existing = await getByIdAdmin(id);
	if (!existing) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Marca no encontrada",
			logLevel: "info",
			doNotLog: true,
		});
	}

	await db.delete(brands).where(eq(brands.id, id));

	// Limpiar carpeta R2 (no bloqueante, no revierte el delete)
	deleteEntityFolder("brands", id).catch((err) =>
		logger.withMetadata({ err }).error(`[R2 cleanup] Failed to delete folder for brand ${id}`),
	);
}

// ── Bulk Delete ─────────────────────────────────────

async function deleteMany(ids: string[]) {
	if (ids.length > MAX_BULK_DELETE) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: `No se pueden eliminar más de ${MAX_BULK_DELETE} marcas`,
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
				.select({ id: brands.id })
				.from(brands)
				.where(inArray(brands.id, ids));

			const existingIds = existing.map((b) => b.id);
			const notFoundIds = ids.filter((id) => !existingIds.includes(id));

			if (existingIds.length === 0) {
				return { deletedIds: [], notFoundIds, deletedCount: 0 };
			}

			await tx.delete(brands).where(inArray(brands.id, existingIds));

			return {
				deletedIds: existingIds,
				notFoundIds,
				deletedCount: existingIds.length,
			};
		})
		.then((result) => {
			for (const id of result.deletedIds) {
				deleteEntityFolder("brands", id).catch((err) =>
					console.error(`[R2 cleanup] Failed to delete folder for brand ${id}:`, err),
				);
			}
			return result;
		});
}

export const BrandService = {
	// Admin
	listAdmin,
	getBySlugAdmin,
	getByIdAdmin,
	create,
	update,
	delete: deleteBrand,
	deleteMany,

	// Public
	listPublic,
	getBySlugPublic,
};
