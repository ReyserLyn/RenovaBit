import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { brands } from "@renovabit/db/schema";
import { desc, eq, inArray, or } from "drizzle-orm";
import slugify from "slugify";
import { deleteEntityFolder, deleteEntityImage, resolveEntityImage } from "@/utils/storage/helpers";
import type { BrandModel } from "./model";

type CreateBody = BrandModel["createBody"];
type UpdateBody = BrandModel["updateBody"];

// ── Helpers ────────────────────────────────────────

function makeSlug(value: string): string {
	return slugify(value, { lower: true, strict: true, trim: true });
}

/**
 * Convierte errores de constraint violation de PostgreSQL (23505)
 * en errores de negocio tipados. Evita 500 por race conditions.
 */
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

// ── Queries ────────────────────────────────────────

async function list(filters?: { isActive?: boolean }) {
	return db
		.select()
		.from(brands)
		.where(filters?.isActive !== undefined ? eq(brands.isActive, filters.isActive) : undefined)
		.orderBy(desc(brands.createdAt));
}

async function getBySlug(slug: string) {
	const [row] = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1);
	return row ?? null;
}

// ── Create ─────────────────────────────────────────

async function create(data: CreateBody) {
	const nextName = data.name.trim();
	const slug = data.slug?.trim() ? makeSlug(data.slug) : makeSlug(nextName);

	const exists = await db
		.select({ id: brands.id, name: brands.name })
		.from(brands)
		.where(or(eq(brands.name, nextName), eq(brands.slug, slug)))
		.limit(1);

	if (exists.length > 0) {
		const isSlugConflict = exists[0]?.name !== data.name;
		throw createApiError({
			code: BackendErrorCodes.EXISTS_ERROR,
			message: isSlugConflict
				? "Ya existe una marca con este slug"
				: "Ya existe una marca con este nombre",
			logLevel: "info",
			doNotLog: true,
		});
	}

	const [item] = await db
		.insert(brands)
		.values({ ...data, name: nextName, slug } as typeof data & { slug: string })
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

async function update(slug: string, data: UpdateBody) {
	const existing = await getBySlug(slug);
	if (!existing) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Marca no encontrada",
			logLevel: "info",
			doNotLog: true,
		});
	}

	// Si cambia el nombre, verificamos que no exista otro
	if (data.name && data.name !== existing.name) {
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

	// Si cambia el slug, verificamos que no exista otro
	if (data.slug && data.slug !== existing.slug) {
		const dup = await db
			.select({ id: brands.id })
			.from(brands)
			.where(eq(brands.slug, data.slug))
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

	// Si cambia la imagen, eliminar la anterior y resolver la nueva
	if (data.imageUrl !== undefined && data.imageUrl !== existing.imageUrl) {
		await deleteEntityImage(existing.imageUrl);
	}

	const [item] = await db
		.update(brands)
		.set(data)
		.where(eq(brands.slug, slug))
		.returning()
		.catch((err) => handleUniqueViolation(err, "Ya existe una marca con este nombre o slug"));

	if (!item) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al actualizar la marca",
		});
	}

	// Resolver nueva imagen pendiente → permanente
	if (item.imageUrl) {
		const permanentUrl = await resolveEntityImage(item.imageUrl, "brands", item.id);
		if (permanentUrl && permanentUrl !== item.imageUrl) {
			await db.update(brands).set({ imageUrl: permanentUrl }).where(eq(brands.id, item.id));
			item.imageUrl = permanentUrl;
		}
	}

	return item;
}

// ── Delete ─────────────────────────────────────────

async function deleteBrand(slug: string) {
	const existing = await getBySlug(slug);
	if (!existing) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Marca no encontrada",
			logLevel: "info",
			doNotLog: true,
		});
	}

	await db.delete(brands).where(eq(brands.slug, slug));

	// Limpiar carpeta R2 (no bloqueante, no revierte el delete)
	deleteEntityFolder("brands", existing.id);
}

// ── Bulk Delete ─────────────────────────────────────

async function deleteMany(ids: string[]) {
	const existing = await db
		.select({ id: brands.id, slug: brands.slug })
		.from(brands)
		.where(inArray(brands.id, ids));

	const existingIds = existing.map((b) => b.id);
	const notFoundIds = ids.filter((id) => !existingIds.includes(id));

	if (existingIds.length === 0) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "No se encontraron marcas para eliminar",
			logLevel: "info",
			doNotLog: true,
		});
	}

	await db.delete(brands).where(inArray(brands.id, existingIds));

	// Limpiar carpetas R2 (no bloqueante)
	existingIds.forEach((id) => deleteEntityFolder("brands", id));

	return {
		deletedCount: existingIds.length,
		deletedIds: existingIds,
		notFoundIds,
	};
}

// ── Public API ─────────────────────────────────────

export const BrandService = {
	list,
	getBySlug,
	create,
	update,
	delete: deleteBrand,
	deleteMany,
};
