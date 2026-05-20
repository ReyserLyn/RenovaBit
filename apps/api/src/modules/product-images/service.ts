import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { productImages, products } from "@renovabit/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { asc, eq } from "drizzle-orm";
import type { ProductImageModel } from "./model";

// ── Types ──────────────────────────────────────────

type ProductImage = InferSelectModel<typeof productImages>;
type CreateBody = ProductImageModel["createBody"];
type UpdateBody = ProductImageModel["updateBody"];

// ── Queries ────────────────────────────────────────

async function listByProduct(productId: string): Promise<ProductImage[]> {
	return db
		.select()
		.from(productImages)
		.where(eq(productImages.productId, productId))
		.orderBy(asc(productImages.sortOrder));
}

async function getById(id: string): Promise<ProductImage | null> {
	const [row] = await db.select().from(productImages).where(eq(productImages.id, id)).limit(1);
	return row ?? null;
}

// ── Create ─────────────────────────────────────────

async function create(data: CreateBody): Promise<ProductImage> {
	// Verificar que el producto existe
	const [product] = await db
		.select({ id: products.id })
		.from(products)
		.where(eq(products.id, data.productId))
		.limit(1);

	if (!product) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "El producto especificado no existe",
			logLevel: "info",
			doNotLog: true,
		});
	}

	return db.transaction(async (tx) => {
		// Si se marca como primaria, desmarcar otras del mismo producto
		if (data.isPrimary) {
			await tx
				.update(productImages)
				.set({ isPrimary: false })
				.where(eq(productImages.productId, data.productId));
		}

		const [item] = await tx.insert(productImages).values(data).returning();

		if (!item) {
			throw createApiError({
				code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
				message: "Error al crear la imagen",
			});
		}

		return item;
	});
}

// ── Update ─────────────────────────────────────────

async function update(id: string, data: UpdateBody): Promise<ProductImage> {
	const current = await getById(id);
	if (!current) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Imagen no encontrada",
			logLevel: "info",
			doNotLog: true,
		});
	}

	return db.transaction(async (tx) => {
		// Si se marca como primaria, desmarcar otras del mismo producto
		if (data.isPrimary) {
			await tx
				.update(productImages)
				.set({ isPrimary: false })
				.where(eq(productImages.productId, current.productId));
		}

		const [item] = await tx
			.update(productImages)
			.set(data)
			.where(eq(productImages.id, id))
			.returning();

		if (!item) {
			throw createApiError({
				code: BackendErrorCodes.NOT_FOUND_ERROR,
				message: "Imagen no encontrada",
				logLevel: "info",
				doNotLog: true,
			});
		}

		return item;
	});
}

// ── Delete ─────────────────────────────────────────

async function deleteById(id: string): Promise<void> {
	const [deleted] = await db
		.delete(productImages)
		.where(eq(productImages.id, id))
		.returning({ id: productImages.id });

	if (!deleted) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Imagen no encontrada",
			logLevel: "info",
			doNotLog: true,
		});
	}
}

// ── Public API ─────────────────────────────────────

export const ProductImageService = {
	listByProduct,
	create,
	update,
	delete: deleteById,
};
