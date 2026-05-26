import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { brands } from "@renovabit/db/schema";
import { desc, eq, inArray, or } from "drizzle-orm";
import slugify from "slugify";
import { deleteEntityFolder, deleteEntityImage, resolveEntityImage } from "@/utils/storage/helpers";
import type { BrandModel } from "./model";

type CreateBody = BrandModel["createBody"];
type UpdateBody = BrandModel["updateBody"];

// ── Constants ──────────────────────────────────────

const MAX_BULK_DELETE = 50;

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

async function getById(id: string) {
	const [row] = await db.select().from(brands).where(eq(brands.id, id)).limit(1);
	return row ?? null;
}

// ── Create ─────────────────────────────────────────

async function create(data: CreateBody, userId: string) {
	const nextName = data.name.trim();
	const slug = data.slug?.trim() ? makeSlug(data.slug) : makeSlug(nextName);

	const exists = await db
		.select({ id: brands.id, name: brands.name })
		.from(brands)
		.where(or(eq(brands.name, nextName), eq(brands.slug, slug)))
		.limit(1);

	if (exists.length > 0) {
		const isSlugConflict = exists[0]?.name !== nextName;
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
		.values({
			...data,
			name: nextName,
			slug,
			createdBy: userId,
			updatedBy: userId,
		} as typeof data & { slug: string })
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
	const existingRow = await getById(id);
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

	// Si cambia el slug, verificamos que no exista otro
	if (data.slug && data.slug !== existingRow.slug) {
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

	const [item] = await db
		.update(brands)
		.set({ ...data, updatedBy: userId })
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
	const existing = await getById(id);
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
	deleteEntityFolder("brands", id);
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
			// Limpiar carpetas R2 (no bloqueante)
			result.deletedIds.forEach((id) => deleteEntityFolder("brands", id));
			return result;
		});
}

// ── Public API ─────────────────────────────────────

export const BrandService = {
	list,
	getBySlug,
	getById,
	create,
	update,
	delete: deleteBrand,
	deleteMany,
};
