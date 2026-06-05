import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { categories, products } from "@renovabit/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { and, asc, count, eq, inArray, like, ne } from "drizzle-orm";
import { handleUniqueViolation, makeSlug } from "@/utils/db-helpers";
import { deleteEntityFolder, deleteEntityImage, resolveEntityImage } from "@/utils/storage/helpers";
import type {
	AdminCategoryTree,
	BreadcrumbItem,
	BulkDeleteResult,
	CategoryModel,
	PublicCategoryDetail,
	PublicCategoryTree,
} from "./model";

type Category = InferSelectModel<typeof categories>;

type ListOptions = {
	includeInactive?: boolean;
	isFeatured?: boolean;
	parentId?: string;
	isVisibleInNav?: boolean;
};

type CreateBody = CategoryModel["createBody"];
type UpdateBody = CategoryModel["updateBody"];

const MAX_DEPTH = 5;
const MAX_BULK_DELETE = 50;

// ── Helpers ────────────────────────────────────────

function parsePathAncestorIds(path: string | null): string[] {
	if (!path) return [];
	return path.split("/").filter((item) => item.length > 0);
}

function buildPath(parent: Pick<Category, "id" | "path"> | null): string {
	if (!parent) return "/";
	return `${parent.path ?? "/"}${parent.id}/`;
}

function categoryDepth(path: string | null): number {
	return 1 + parsePathAncestorIds(path).length;
}

function buildCategoryTree(rows: Category[]): AdminCategoryTree[] {
	const byParent = new Map<string | null, Category[]>();
	for (const row of rows) {
		const key = row.parentId ?? null;
		const group = byParent.get(key) ?? [];
		group.push(row);
		byParent.set(key, group);
	}

	for (const [, group] of byParent) {
		group.sort((a, b) => {
			const aOrder = a.sortOrder ?? 0;
			const bOrder = b.sortOrder ?? 0;
			if (aOrder !== bOrder) return aOrder - bOrder;
			return a.name.localeCompare(b.name);
		});
	}

	const mapNode = (row: Category): AdminCategoryTree => ({
		id: row.id,
		name: row.name,
		slug: row.slug,
		imageUrl: row.imageUrl,
		description: row.description,
		sortOrder: row.sortOrder,
		isFeatured: row.isFeatured,
		isActive: row.isActive,
		isVisibleInNav: row.isVisibleInNav,
		children: (byParent.get(row.id) ?? []).map(mapNode),
	});

	return (byParent.get(null) ?? []).map(mapNode);
}

// ── Unique checks ──────────────────────────────────

async function ensureUniqueName(name: string, excludeId?: string): Promise<void> {
	const conditions = [eq(categories.name, name)];
	if (excludeId) conditions.push(ne(categories.id, excludeId));
	const where = conditions.length === 1 ? conditions[0] : and(...conditions);
	const [existing] = await db.select({ id: categories.id }).from(categories).where(where).limit(1);
	if (existing) {
		throw createApiError({
			code: BackendErrorCodes.EXISTS_ERROR,
			message: "Ya existe una categoría con este nombre",
			logLevel: "info",
			doNotLog: true,
		});
	}
}

async function ensureUniqueSlug(slug: string, excludeId?: string): Promise<void> {
	const conditions = [eq(categories.slug, slug)];
	if (excludeId) conditions.push(ne(categories.id, excludeId));
	const where = conditions.length === 1 ? conditions[0] : and(...conditions);
	const [existing] = await db.select({ id: categories.id }).from(categories).where(where).limit(1);
	if (existing) {
		throw createApiError({
			code: BackendErrorCodes.EXISTS_ERROR,
			message: "Ya existe una categoría con este slug",
			logLevel: "info",
			doNotLog: true,
		});
	}
}

// ═══════════════════════════════════════════════════
//  ADMIN QUERIES
// ═══════════════════════════════════════════════════

async function listAdmin(options: ListOptions = {}): Promise<Category[]> {
	const conditions = [];

	if (options.includeInactive === false) {
		conditions.push(eq(categories.isActive, true));
	}
	if (typeof options.isVisibleInNav === "boolean") {
		conditions.push(eq(categories.isVisibleInNav, options.isVisibleInNav));
	}
	if (typeof options.isFeatured === "boolean") {
		conditions.push(eq(categories.isFeatured, options.isFeatured));
	}
	if (options.parentId) {
		conditions.push(eq(categories.parentId, options.parentId));
	}

	const where = conditions.length === 0 ? undefined : and(...conditions);

	return db
		.select()
		.from(categories)
		.where(where)
		.orderBy(asc(categories.sortOrder), asc(categories.name));
}

async function getBySlugAdmin(slug: string): Promise<Category | null> {
	const [row] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
	return row ?? null;
}

async function getByIdAdmin(id: string): Promise<Category | null> {
	const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
	return row ?? null;
}

async function getTreeAdmin(includeInactive?: boolean): Promise<AdminCategoryTree[]> {
	const rows = includeInactive
		? await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name))
		: await db
				.select()
				.from(categories)
				.where(and(eq(categories.isActive, true), eq(categories.isVisibleInNav, true)))
				.orderBy(asc(categories.sortOrder), asc(categories.name));

	return buildCategoryTree(rows);
}

// ═══════════════════════════════════════════════════
//  PUBLIC QUERIES
// ═══════════════════════════════════════════════════

async function getProductCounts(): Promise<Map<string, number>> {
	const rows = await db
		.select({ categoryId: products.categoryId, cnt: count(products.id) })
		.from(products)
		.where(and(eq(products.isActive, true), eq(products.needsReview, false)))
		.groupBy(products.categoryId);

	const map = new Map<string, number>();
	for (const row of rows) {
		if (row.categoryId) map.set(row.categoryId, Number(row.cnt));
	}
	return map;
}

function buildPublicTree(
	flatRows: Category[],
	productCounts: Map<string, number>,
): PublicCategoryTree[] {
	const byParent = new Map<string | null, Category[]>();
	for (const row of flatRows) {
		const key = row.parentId ?? null;
		const group = byParent.get(key) ?? [];
		group.push(row);
		byParent.set(key, group);
	}

	for (const [, group] of byParent) {
		group.sort((a, b) => {
			const aOrder = a.sortOrder ?? 0;
			const bOrder = b.sortOrder ?? 0;
			if (aOrder !== bOrder) return aOrder - bOrder;
			return a.name.localeCompare(b.name);
		});
	}

	const mergeCounts = (node: PublicCategoryTree): number => {
		const childrenTotal = node.children.reduce((sum, child) => sum + mergeCounts(child), 0);
		node.productCount = (productCounts.get(node.id) ?? 0) + childrenTotal;
		return node.productCount;
	};

	const mapNode = (row: Category): PublicCategoryTree => ({
		id: row.id,
		name: row.name,
		slug: row.slug,
		imageUrl: row.imageUrl,
		description: row.description,
		productCount: 0,
		children: (byParent.get(row.id) ?? []).map(mapNode),
	});

	const roots = (byParent.get(null) ?? []).map(mapNode);
	for (const root of roots) mergeCounts(root);
	return roots;
}

async function getTreePublic(): Promise<PublicCategoryTree[]> {
	const [flatRows, productCounts] = await Promise.all([
		db
			.select()
			.from(categories)
			.where(eq(categories.isActive, true))
			.orderBy(asc(categories.sortOrder), asc(categories.name)),
		getProductCounts(),
	]);

	return buildPublicTree(flatRows, productCounts);
}

async function getBySlugPublic(slug: string): Promise<PublicCategoryDetail | null> {
	const [category] = await db
		.select()
		.from(categories)
		.where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
		.limit(1);

	if (!category) return null;

	const ancestorIds = parsePathAncestorIds(category.path);
	let breadcrumb: BreadcrumbItem[];

	if (ancestorIds.length === 0) {
		breadcrumb = [{ id: category.id, name: category.name, slug: category.slug }];
	} else {
		const ancestors = await db
			.select({ id: categories.id, name: categories.name, slug: categories.slug })
			.from(categories)
			.where(and(inArray(categories.id, ancestorIds), eq(categories.isActive, true)));

		const map = new Map(ancestors.map((a) => [a.id, a]));
		const ordered = ancestorIds
			.map((id) => map.get(id))
			.filter((item): item is BreadcrumbItem => !!item);

		breadcrumb = [...ordered, { id: category.id, name: category.name, slug: category.slug }];
	}

	const [row] = await db
		.select({ cnt: count(products.id) })
		.from(products)
		.where(
			and(
				eq(products.categoryId, category.id),
				eq(products.isActive, true),
				eq(products.needsReview, false),
			),
		);

	return {
		id: category.id,
		name: category.name,
		slug: category.slug,
		description: category.description,
		imageUrl: category.imageUrl,
		isFeatured: category.isFeatured,
		breadcrumb,
		productCount: Number(row?.cnt ?? 0),
	};
}

// ═══════════════════════════════════════════════════
//  CREATE / UPDATE / DELETE (admin)
// ═══════════════════════════════════════════════════

async function getByIdStrict(id: string): Promise<Category> {
	const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
	if (!row) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Categoría no encontrada",
			logLevel: "info",
			doNotLog: true,
		});
	}
	return row;
}

async function create(data: CreateBody, userId: string): Promise<Category> {
	const nextName = data.name.trim();
	const nextSlug = data.slug?.trim() ? makeSlug(data.slug) : makeSlug(nextName);

	if (!nextSlug) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "El slug de la categoría no puede estar vacío",
			logLevel: "info",
			doNotLog: true,
		});
	}

	await ensureUniqueName(nextName);
	await ensureUniqueSlug(nextSlug);

	const parent = data.parentId ? await getByIdStrict(data.parentId) : null;
	const nextPath = buildPath(parent);

	if (categoryDepth(nextPath) > MAX_DEPTH) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: `El árbol de categorías no puede exceder ${MAX_DEPTH} niveles`,
			logLevel: "info",
			doNotLog: true,
		});
	}

	const [item] = await db
		.insert(categories)
		.values({
			...data,
			name: nextName,
			slug: nextSlug,
			path: nextPath,
			createdBy: userId,
			updatedBy: userId,
		} as typeof data & { slug: string; path: string })
		.returning()
		.catch((err) => handleUniqueViolation(err, "Ya existe una categoría con este nombre o slug"));

	if (!item) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al crear la categoría",
		});
	}

	if (item.imageUrl) {
		const permanentUrl = await resolveEntityImage(item.imageUrl, "categories", item.id);
		if (permanentUrl && permanentUrl !== item.imageUrl) {
			await db.update(categories).set({ imageUrl: permanentUrl }).where(eq(categories.id, item.id));
			item.imageUrl = permanentUrl;
		}
	}

	return item;
}

async function update(id: string, data: UpdateBody, userId: string): Promise<Category> {
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
			message: "El slug de la categoría no puede estar vacío",
			logLevel: "info",
			doNotLog: true,
		});
	}

	if (nextName !== current.name) await ensureUniqueName(nextName, id);
	if (nextSlug !== current.slug) await ensureUniqueSlug(nextSlug, id);

	const parentChanged = "parentId" in data && data.parentId !== current.parentId;
	let nextParent: Category | null = null;

	if (parentChanged) {
		if (data.parentId === id) {
			throw createApiError({
				code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
				message: "Una categoría no puede ser padre de sí misma",
				logLevel: "info",
				doNotLog: true,
			});
		}
		nextParent = data.parentId ? await getByIdStrict(data.parentId) : null;
		const parentAncestors = parsePathAncestorIds(nextParent?.path ?? null);
		if (nextParent && parentAncestors.includes(id)) {
			throw createApiError({
				code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
				message: "No se puede mover una categoría bajo uno de sus descendientes",
				logLevel: "info",
				doNotLog: true,
			});
		}
	}

	const nextPath = parentChanged ? buildPath(nextParent) : current.path;

	if (parentChanged) {
		const oldDepth = categoryDepth(current.path);
		const newBaseDepth = categoryDepth(nextPath);
		const oldPrefix = `${current.path ?? "/"}${current.id}/`;

		const descendants = await db
			.select({ path: categories.path })
			.from(categories)
			.where(like(categories.path, `${oldPrefix}%`));

		let maxDelta = 0;
		for (const row of descendants) {
			const delta = categoryDepth(row.path) - oldDepth;
			if (delta > maxDelta) maxDelta = delta;
		}

		if (newBaseDepth + maxDelta > MAX_DEPTH) {
			throw createApiError({
				code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
				message: `El árbol de categorías no puede exceder ${MAX_DEPTH} niveles`,
				logLevel: "info",
				doNotLog: true,
			});
		}
	}

	const newImageUrl = data.imageUrl;
	if (newImageUrl !== undefined && newImageUrl !== current.imageUrl) {
		await deleteEntityImage(current.imageUrl);
	}

	const baseUpdate = { ...data, name: nextName, slug: nextSlug, path: nextPath, updatedBy: userId };

	return db
		.transaction(async (tx) => {
			const [updated] = await tx
				.update(categories)
				.set(baseUpdate)
				.where(eq(categories.id, id))
				.returning();
			if (!updated) {
				throw createApiError({
					code: BackendErrorCodes.NOT_FOUND_ERROR,
					message: "Categoría no encontrada",
					logLevel: "info",
					doNotLog: true,
				});
			}

			if (parentChanged) {
				const oldPrefix = `${current.path ?? "/"}${current.id}/`;
				const newPrefix = `${nextPath ?? "/"}${updated.id}/`;
				const descendants = await tx
					.select({ id: categories.id, path: categories.path })
					.from(categories)
					.where(like(categories.path, `${oldPrefix}%`));
				for (const descendant of descendants) {
					const replaced = (descendant.path ?? "/").replace(oldPrefix, newPrefix);
					await tx
						.update(categories)
						.set({ path: replaced })
						.where(eq(categories.id, descendant.id));
				}
			}

			if (data.isActive === false) {
				const subtreePrefix = `${updated.path ?? "/"}${updated.id}/`;
				await tx
					.update(categories)
					.set({ isActive: false })
					.where(like(categories.path, `${subtreePrefix}%`));
			}
			if (data.isActive === true && updated.path) {
				const ancestorIds = parsePathAncestorIds(updated.path);
				if (ancestorIds.length > 0) {
					await tx
						.update(categories)
						.set({ isActive: true })
						.where(and(inArray(categories.id, ancestorIds), eq(categories.isActive, false)));
				}
			}

			return updated;
		})
		.then(async (updated) => {
			if (newImageUrl) {
				const permanentUrl = await resolveEntityImage(newImageUrl, "categories", updated.id);
				if (permanentUrl && permanentUrl !== newImageUrl) {
					await db
						.update(categories)
						.set({ imageUrl: permanentUrl })
						.where(eq(categories.id, updated.id));
					updated.imageUrl = permanentUrl;
				}
			}
			return updated;
		});
}

async function deleteById(id: string): Promise<Category> {
	return db
		.transaction(async (tx) => {
			const [child] = await tx
				.select({ id: categories.id })
				.from(categories)
				.where(eq(categories.parentId, id))
				.limit(1);
			if (child) {
				throw createApiError({
					code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
					message:
						"No se puede eliminar una categoría con descendientes. Elimina los hijos primero.",
					logLevel: "info",
					doNotLog: true,
				});
			}
			const [deleted] = await tx.delete(categories).where(eq(categories.id, id)).returning();
			if (!deleted) {
				throw createApiError({
					code: BackendErrorCodes.NOT_FOUND_ERROR,
					message: "Categoría no encontrada",
					logLevel: "info",
					doNotLog: true,
				});
			}
			return deleted;
		})
		.then((deleted) => {
			deleteEntityFolder("categories", deleted.id);
			return deleted;
		});
}

async function deleteMany(ids: string[]): Promise<BulkDeleteResult> {
	if (ids.length > MAX_BULK_DELETE) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: `No se pueden eliminar más de ${MAX_BULK_DELETE} categorías`,
			logLevel: "info",
			doNotLog: true,
		});
	}

	return db
		.transaction(async (tx) => {
			const existing = await tx
				.select({ id: categories.id })
				.from(categories)
				.where(inArray(categories.id, ids));
			const existingIds = existing.map((e) => e.id);
			const notFoundIds = ids.filter((id) => !existingIds.includes(id));
			if (existingIds.length === 0) {
				return { deletedIds: [], notFoundIds, deletedCount: 0 };
			}

			const [blocked] = await tx
				.select({ id: categories.id })
				.from(categories)
				.where(inArray(categories.parentId, existingIds))
				.limit(1);
			if (blocked) {
				throw createApiError({
					code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
					message: "No se pueden eliminar categorías con descendientes",
					logLevel: "info",
					doNotLog: true,
				});
			}

			const deleted = await tx
				.delete(categories)
				.where(inArray(categories.id, existingIds))
				.returning({ id: categories.id });
			return {
				deletedIds: deleted.map((d) => d.id),
				notFoundIds,
				deletedCount: deleted.length,
			};
		})
		.then((result) => {
			result.deletedIds.forEach((id) => deleteEntityFolder("categories", id));
			return result;
		});
}

export const CategoryService = {
	// Admin
	listAdmin,
	getBySlugAdmin,
	getByIdAdmin,
	getTreeAdmin,
	create,
	update,
	delete: deleteById,
	deleteMany,

	// Public
	getTreePublic,
	getBySlugPublic,
};
