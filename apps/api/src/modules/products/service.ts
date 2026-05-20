import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { brands, categories, products } from "@renovabit/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import slugify from "slugify";
import type { ProductModel } from "./model";

// ── Types ──────────────────────────────────────────

type Product = InferSelectModel<typeof products>;

type ListOptions = {
	brandId?: string;
	categoryId?: string;
	isFeatured?: boolean;
	includeInactive?: boolean;
};

type BulkDeleteResult = {
	deletedIds: string[];
	notFoundIds: string[];
	deletedCount: number;
};

type CreateBody = ProductModel["createBody"];
type UpdateBody = ProductModel["updateBody"];

// ── Constants ──────────────────────────────────────

const PUBLIC_STATUSES = ["active", "out_of_stock"] as const;
const MAX_BULK_DELETE = 50;

// ── Helpers ────────────────────────────────────────

function makeSlug(value: string): string {
	return slugify(value, { lower: true, strict: true, trim: true });
}

function statusFilter(includeInactive: boolean) {
	if (includeInactive) return undefined;
	return inArray(products.status, PUBLIC_STATUSES);
}

function handleUniqueViolation(error: unknown, fallbackMessage: string): never {
	if (
		error &&
		typeof error === "object" &&
		"code" in error &&
		(error as Record<string, unknown>).code === "23505"
	) {
		throw createApiError({
			code: BackendErrorCodes.EXISTS_ERROR,
			message: fallbackMessage,
			logLevel: "info",
			doNotLog: true,
		});
	}
	throw error;
}

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

// ── Queries ────────────────────────────────────────

async function list(options: ListOptions = {}, isAdmin = false): Promise<Product[]> {
	const conditions = [];

	// Visibility: non-admin always filters to public statuses
	if (!isAdmin) {
		conditions.push(inArray(products.status, PUBLIC_STATUSES));
	} else {
		const sf = statusFilter(options.includeInactive ?? false);
		if (sf) conditions.push(sf);
	}

	if (options.brandId) conditions.push(eq(products.brandId, options.brandId));
	if (options.categoryId) conditions.push(eq(products.categoryId, options.categoryId));
	if (options.isFeatured !== undefined)
		conditions.push(eq(products.isFeatured, options.isFeatured));

	const where =
		conditions.length === 0
			? undefined
			: conditions.length === 1
				? conditions[0]
				: and(...conditions);

	return db.select().from(products).where(where).orderBy(desc(products.createdAt));
}

async function getBySlug(slug: string, isAdmin = false): Promise<Product | null> {
	const where = isAdmin
		? eq(products.slug, slug)
		: and(eq(products.slug, slug), inArray(products.status, PUBLIC_STATUSES));

	const [row] = await db.select().from(products).where(where).limit(1);
	return row ?? null;
}

async function getById(id: string, isAdmin = false): Promise<Product | null> {
	const where = isAdmin
		? eq(products.id, id)
		: and(eq(products.id, id), inArray(products.status, PUBLIC_STATUSES));

	const [row] = await db.select().from(products).where(where).limit(1);
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

// ── Create ─────────────────────────────────────────

async function create(data: CreateBody): Promise<Product> {
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
		.values({ ...data, name: nextName, slug: nextSlug } as typeof data & { slug: string })
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

async function update(id: string, data: UpdateBody): Promise<Product> {
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

	const baseUpdate = { ...data, name: nextName, slug: nextSlug };

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

	return db.transaction(async (tx) => {
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
	});
}

// ── Public API ─────────────────────────────────────

export const ProductService = {
	list,
	getBySlug,
	getById,
	create,
	update,
	delete: deleteById,
	deleteMany,
};
