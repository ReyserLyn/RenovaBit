import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { categories } from "@renovabit/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { and, asc, eq, inArray, like, ne } from "drizzle-orm";
import slugify from "slugify";
import type { CategoryModel } from "./model";

// ── Types ──────────────────────────────────────────

type Category = InferSelectModel<typeof categories>;

type ListOptions = {
	includeInactive?: boolean;
	isFeatured?: boolean;
	parentId?: string;
	isVisibleInNav?: boolean;
};

export type CategoryTreeNode = {
	id: string;
	name: string;
	slug: string;
	imageUrl: string | null;
	description: string | null;
	sortOrder: number | null;
	isFeatured: boolean;
	isActive: boolean;
	isVisibleInNav: boolean;
	children: CategoryTreeNode[];
};

type BreadcrumbItem = {
	id: string;
	name: string;
	slug: string;
};

type BulkDeleteResult = {
	deletedIds: string[];
	notFoundIds: string[];
	deletedCount: number;
};

type CreateBody = CategoryModel["createBody"];
type UpdateBody = CategoryModel["updateBody"];

// ── Constants ──────────────────────────────────────

const MAX_DEPTH = 5;
const MAX_REORDER = 100;
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

function makeSlug(value: string): string {
	return slugify(value, { lower: true, strict: true, trim: true });
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

// ── Tree builder ───────────────────────────────────

function buildCategoryTree(rows: Category[]): CategoryTreeNode[] {
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

	const mapNode = (row: Category): CategoryTreeNode => ({
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

// ── Queries ────────────────────────────────────────

async function list(options: ListOptions = {}, isAdmin = false): Promise<Category[]> {
	const conditions = [];

	if (!isAdmin) {
		conditions.push(eq(categories.isActive, true));
		conditions.push(eq(categories.isVisibleInNav, true));
	} else {
		if (!options.includeInactive) {
			conditions.push(eq(categories.isActive, true));
		}
		if (typeof options.isVisibleInNav === "boolean") {
			conditions.push(eq(categories.isVisibleInNav, options.isVisibleInNav));
		}
	}

	if (typeof options.isFeatured === "boolean") {
		conditions.push(eq(categories.isFeatured, options.isFeatured));
	}

	if (options.parentId) {
		conditions.push(eq(categories.parentId, options.parentId));
	}

	const where =
		conditions.length === 0
			? undefined
			: conditions.length === 1
				? conditions[0]
				: and(...conditions);

	return db
		.select()
		.from(categories)
		.where(where)
		.orderBy(asc(categories.sortOrder), asc(categories.name));
}

async function getBySlug(slug: string, includeInactive = false): Promise<Category | null> {
	const where = includeInactive
		? eq(categories.slug, slug)
		: and(
				eq(categories.slug, slug),
				eq(categories.isActive, true),
				eq(categories.isVisibleInNav, true),
			);

	const [row] = await db.select().from(categories).where(where).limit(1);
	return row ?? null;
}

async function getById(id: string, includeInactive = false): Promise<Category | null> {
	const where = includeInactive
		? eq(categories.id, id)
		: and(
				eq(categories.id, id),
				eq(categories.isActive, true),
				eq(categories.isVisibleInNav, true),
			);

	const [row] = await db.select().from(categories).where(where).limit(1);
	return row ?? null;
}

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

async function getTree(includeInactive = false): Promise<CategoryTreeNode[]> {
	const rows = includeInactive
		? await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name))
		: await db
				.select()
				.from(categories)
				.where(and(eq(categories.isActive, true), eq(categories.isVisibleInNav, true)))
				.orderBy(asc(categories.sortOrder), asc(categories.name));

	return buildCategoryTree(rows);
}

async function getBreadcrumb(slug: string, includeInactive = false): Promise<BreadcrumbItem[]> {
	const category = await getBySlug(slug, includeInactive);
	if (!category) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Categoría no encontrada",
			logLevel: "info",
			doNotLog: true,
		});
	}

	const ancestorIds = parsePathAncestorIds(category.path);

	if (ancestorIds.length === 0) {
		return [{ id: category.id, name: category.name, slug: category.slug }];
	}

	const ancestors = await db
		.select({ id: categories.id, name: categories.name, slug: categories.slug })
		.from(categories)
		.where(
			includeInactive
				? inArray(categories.id, ancestorIds)
				: and(
						inArray(categories.id, ancestorIds),
						eq(categories.isActive, true),
						eq(categories.isVisibleInNav, true),
					),
		);

	const map = new Map(ancestors.map((a) => [a.id, a]));
	const orderedAncestors = ancestorIds
		.map((id) => map.get(id))
		.filter((item): item is BreadcrumbItem => !!item);

	return [...orderedAncestors, { id: category.id, name: category.name, slug: category.slug }];
}

// ── Create ─────────────────────────────────────────

async function create(data: CreateBody): Promise<Category> {
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
		} as typeof data & { slug: string; path: string })
		.returning()
		.catch((err) => handleUniqueViolation(err, "Ya existe una categoría con este nombre o slug"));

	if (!item) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al crear la categoría",
		});
	}

	return item;
}

// ── Update ─────────────────────────────────────────

async function update(id: string, data: UpdateBody): Promise<Category> {
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

	if (nextName !== current.name) {
		await ensureUniqueName(nextName, id);
	}
	if (nextSlug !== current.slug) {
		await ensureUniqueSlug(nextSlug, id);
	}

	const parentChanged = data.parentId !== undefined && data.parentId !== current.parentId;
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

	const baseUpdate = {
		...data,
		name: nextName,
		slug: nextSlug,
		path: nextPath,
	};

	return db.transaction(async (tx) => {
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
				await tx.update(categories).set({ path: replaced }).where(eq(categories.id, descendant.id));
			}
		}

		if (data.isActive === false) {
			const subtreePrefix = `${updated.path ?? "/"}${updated.id}/`;
			await tx
				.update(categories)
				.set({ isActive: false })
				.where(like(categories.path, `${subtreePrefix}%`));
		}

		return updated;
	});
}

// ── Reorder ────────────────────────────────────────

async function reorder(orders: Array<{ id: string; sortOrder: number }>): Promise<Category[]> {
	if (orders.length > MAX_REORDER) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: `No se pueden reordenar más de ${MAX_REORDER} categorías`,
			logLevel: "info",
			doNotLog: true,
		});
	}

	const ids = orders.map((o) => o.id);
	const uniqueIds = new Set(ids);
	if (uniqueIds.size !== ids.length) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "No se permiten IDs duplicados en el reordenamiento",
			logLevel: "info",
			doNotLog: true,
		});
	}

	const existing = await db
		.select({ id: categories.id })
		.from(categories)
		.where(inArray(categories.id, ids));
	const existingSet = new Set(existing.map((e) => e.id));
	const missing = ids.filter((id) => !existingSet.has(id));

	if (missing.length > 0) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Una o más categorías no existen",
			logLevel: "info",
			doNotLog: true,
		});
	}

	return db.transaction(async (tx) => {
		for (const order of orders) {
			await tx
				.update(categories)
				.set({ sortOrder: order.sortOrder })
				.where(eq(categories.id, order.id));
		}

		const updatedRows = await tx.select().from(categories).where(inArray(categories.id, ids));
		const byId = new Map(updatedRows.map((row) => [row.id, row]));

		return ids.map((itemId) => byId.get(itemId)).filter((row): row is Category => !!row);
	});
}

// ── Delete ─────────────────────────────────────────

async function deleteById(id: string): Promise<Category> {
	return db.transaction(async (tx) => {
		const [child] = await tx
			.select({ id: categories.id })
			.from(categories)
			.where(eq(categories.parentId, id))
			.limit(1);

		if (child) {
			throw createApiError({
				code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
				message: "No se puede eliminar una categoría con descendientes. Elimina los hijos primero.",
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

	return db.transaction(async (tx) => {
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
	});
}

// ── Public API ─────────────────────────────────────

export const CategoryService = {
	list,
	getBySlug,
	getById,
	getTree,
	getBreadcrumb,
	create,
	update,
	reorder,
	delete: deleteById,
	deleteMany,
};
