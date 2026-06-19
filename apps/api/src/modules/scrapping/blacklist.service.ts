import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { productProviders, products, scrapingBlacklist } from "@renovabit/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { handleUniqueViolation } from "@/utils/db-helpers";
import { deleteEntityFolder } from "@/utils/storage/helpers";
import type { BlacklistModel } from "./blacklist.model";

// ── Constants ──────────────────────────────────────

const DEFAULT_SOURCE = "rematazo";

// ── Types ──────────────────────────────────────────

type AddBody = BlacklistModel["addBody"];
type RemoveBody = BlacklistModel["removeBody"];

// ── Queries ────────────────────────────────────────

async function list(source?: string) {
	const where = source ? eq(scrapingBlacklist.source, source) : undefined;
	return db
		.select()
		.from(scrapingBlacklist)
		.where(where)
		.orderBy(desc(scrapingBlacklist.createdAt));
}

// ── Add ────────────────────────────────────────────

async function add(data: AddBody, userId: string) {
	const source = data.source?.trim() || DEFAULT_SOURCE;
	const externalId = data.externalId.trim();

	if (!externalId) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "El ID externo del proveedor es requerido",
			logLevel: "info",
			doNotLog: true,
		});
	}

	// Idempotente: si ya existe, lo retornamos sin hacer nada
	const [existing] = await db
		.select()
		.from(scrapingBlacklist)
		.where(and(eq(scrapingBlacklist.source, source), eq(scrapingBlacklist.externalId, externalId)))
		.limit(1);

	if (existing) {
		return { entry: existing, productDeleted: false };
	}

	// Buscar producto vinculado para eliminarlo y guardar su nombre
	let productName = data.productName?.trim() || null;
	let productDeleted = false;

	const [provider] = await db
		.select({ productId: productProviders.productId })
		.from(productProviders)
		.where(and(eq(productProviders.source, source), eq(productProviders.externalId, externalId)))
		.limit(1);

	if (provider) {
		// Obtener el nombre del producto antes de eliminarlo (si no vino en el body)
		if (!productName) {
			const [product] = await db
				.select({ name: products.name })
				.from(products)
				.where(eq(products.id, provider.productId))
				.limit(1);

			if (product) productName = product.name;
		}

		// Eliminar producto (cascade borra providers, images, changes)
		await db.delete(products).where(eq(products.id, provider.productId));

		// Limpiar carpeta R2 (no bloqueante)
		deleteEntityFolder("products", provider.productId);

		productDeleted = true;
	}

	// Insertar en blacklist
	const [entry] = await db
		.insert(scrapingBlacklist)
		.values({
			source,
			externalId,
			productName,
			reason: data.reason?.trim() || null,
			createdBy: userId,
		})
		.returning()
		.catch((err) => handleUniqueViolation(err, "Este ID de proveedor ya está en la lista negra"));

	if (!entry) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "No se pudo crear la entrada en la lista negra",
		});
	}

	return { entry, productDeleted };
}

// ── Remove ─────────────────────────────────────────

async function remove(data: RemoveBody) {
	const source = data.source?.trim() || DEFAULT_SOURCE;
	const externalId = data.externalId.trim();

	const [deleted] = await db
		.delete(scrapingBlacklist)
		.where(and(eq(scrapingBlacklist.source, source), eq(scrapingBlacklist.externalId, externalId)))
		.returning();

	return deleted ?? null;
}

// ── Public API ─────────────────────────────────────

export const BlacklistService = {
	list,
	add,
	remove,
};
