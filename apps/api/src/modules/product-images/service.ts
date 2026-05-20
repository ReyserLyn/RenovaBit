import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { productImages, products } from "@renovabit/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { asc, eq } from "drizzle-orm";
import { logger } from "@/utils/logger";
import {
	deleteEntityImage,
	extractKeyFromUrl,
	getPublicUrl,
	isPendingUrl,
	moveObject,
} from "@/utils/storage/helpers";
import type { ProductImageModel } from "./model";

// ── Types ──────────────────────────────────────────

type ProductImage = InferSelectModel<typeof productImages>;
type CreateBody = ProductImageModel["createBody"];
type UpdateBody = ProductImageModel["updateBody"];

// ── Helpers ────────────────────────────────────────

/**
 * Resuelve una URL pendiente a su ubicación permanente.
 * Path: products/{productId}/{imageId}.{ext}
 * Así deleteEntityFolder("products", productId) limpia todo.
 */
async function resolveImageUrl(
	imageUrl: string | null,
	productId: string,
	imageId: string,
): Promise<string | null> {
	if (!imageUrl || !isPendingUrl(imageUrl)) return imageUrl;

	const key = extractKeyFromUrl(imageUrl);
	if (!key) return imageUrl;

	const ext = key.split(".").pop() || "jpg";
	const permanentKey = `products/${productId}/${imageId}.${ext}`;

	try {
		await moveObject(key, permanentKey);
		return getPublicUrl(permanentKey);
	} catch (error) {
		logger
			.withError(error)
			.warn(`[R2] No se pudo resolver imagen products/${productId}/${imageId}`);
		return imageUrl;
	}
}

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

	return db
		.transaction(async (tx) => {
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
		})
		.then(async (item) => {
			// Resolver imagen pendiente → products/{productId}/{imageId}.{ext}
			const permanentUrl = await resolveImageUrl(item.url, item.productId, item.id);
			if (permanentUrl && permanentUrl !== item.url) {
				await db
					.update(productImages)
					.set({ url: permanentUrl })
					.where(eq(productImages.id, item.id));
				item.url = permanentUrl;
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

	// Si cambia la URL, eliminar la anterior (fuera de transacción)
	if (data.url !== undefined && data.url !== current.url) {
		await deleteEntityImage(current.url);
	}

	return db
		.transaction(async (tx) => {
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
		})
		.then(async (item) => {
			// Resolver nueva imagen pendiente → products/{productId}/{imageId}.{ext}
			const permanentUrl = await resolveImageUrl(item.url, item.productId, item.id);
			if (permanentUrl && permanentUrl !== item.url) {
				await db
					.update(productImages)
					.set({ url: permanentUrl })
					.where(eq(productImages.id, item.id));
				item.url = permanentUrl;
			}
			return item;
		});
}

// ── Delete ─────────────────────────────────────────

async function deleteById(id: string): Promise<void> {
	const current = await getById(id);
	if (!current) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Imagen no encontrada",
			logLevel: "info",
			doNotLog: true,
		});
	}

	await db.delete(productImages).where(eq(productImages.id, id));

	// Limpiar archivo R2 (no bloqueante)
	deleteEntityImage(current.url);
}

// ── Public API ─────────────────────────────────────

export const ProductImageService = {
	listByProduct,
	create,
	update,
	delete: deleteById,
};
