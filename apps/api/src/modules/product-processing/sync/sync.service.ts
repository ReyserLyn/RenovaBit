import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import {
	brands,
	categories,
	productChanges,
	productImages,
	productProviders,
	products,
	scrapingBlacklist,
	syncReports,
} from "@renovabit/db/schema";
import { getEffectiveSalePrice } from "@renovabit/pricing";
import { and, eq, inArray } from "drizzle-orm";
import pLimit from "p-limit";
import slugify from "slugify";
import type { ScrapedItem } from "@/modules/scrapping/model";
import { scrapingService } from "@/modules/scrapping/service";
import { logger } from "@/utils/logger";
import { getActiveMarginRules } from "@/utils/margin-rules";
import { extractFromRawName } from "../ai/ai.service";
import { processProductImage, removeImageReviewReason } from "../image-pipeline/process";
import type { SyncStats } from "./sync.model";

const PROVIDER_SOURCE = "rematazo";
const AI_CONCURRENCY = 5;
const IMAGE_CONCURRENCY = 3;

const imageLimit = pLimit(IMAGE_CONCURRENCY);

function makeSlug(value: string): string {
	return slugify(value, { lower: true, strict: true, trim: true });
}

function makeSku(providerId: string): string {
	return `RB-${providerId}-RM`;
}

/**
 * Computes the supplier + sale price pair from a raw supplier price using the
 * active margin rules (price tiers). Per-product roleCustomMargins do not
 * apply here (sync imports have no product row to consult).
 *
 * Returns `null` when the raw price is missing/zero — callers should skip the
 * price write in that case.
 */
async function computePricingFromRules(
	rawPrice: string,
): Promise<{ supplierPrice: string; salePrice: string } | null> {
	const supplierPrice = Number.parseFloat(rawPrice);
	if (!Number.isFinite(supplierPrice) || supplierPrice <= 0) return null;

	const rules = await getActiveMarginRules();

	const { salePrice } = getEffectiveSalePrice(
		{ supplierPrice: rawPrice, roleCustomMargins: null },
		"customer",
		rules,
	);

	return { supplierPrice: rawPrice, salePrice: salePrice.toFixed(2) };
}

/** Detecta precios placeholder (9999, 99999…, "2") */
function isPlaceholderPrice(rawPrice: string): boolean {
	const cleaned = rawPrice.replace(/[^0-9]/g, "");
	if (cleaned.length >= 4 && /^9+$/.test(cleaned)) return true;
	if (cleaned === "2") return true;
	return false;
}

async function ensureUniqueSlug(baseSlug: string, providerId: string): Promise<string> {
	const [existing] = await db
		.select({ id: products.id })
		.from(products)
		.where(eq(products.slug, baseSlug))
		.limit(1);

	if (!existing) return baseSlug;
	return `${baseSlug}-${providerId}`;
}

async function findOrCreateBrand(name: string): Promise<string | null> {
	const cleanName = name?.trim();
	if (!cleanName) return null;

	const brandSlug = makeSlug(cleanName);
	const [existing] = await db
		.select({ id: brands.id })
		.from(brands)
		.where(eq(brands.slug, brandSlug))
		.limit(1);

	if (existing) return existing.id;

	const [created] = await db
		.insert(brands)
		.values({ name: cleanName, slug: brandSlug, isActive: true })
		.returning({ id: brands.id });

	return created?.id ?? null;
}

async function findOrCreateCategory(name: string): Promise<string | null> {
	const cleanName = name?.trim();
	if (!cleanName) return null;

	const categorySlug = makeSlug(cleanName);
	const [existing] = await db
		.select({ id: categories.id })
		.from(categories)
		.where(eq(categories.slug, categorySlug))
		.limit(1);

	if (existing) return existing.id;

	const [created] = await db
		.insert(categories)
		.values({ name: cleanName, slug: categorySlug, isActive: true })
		.returning({ id: categories.id });

	return created?.id ?? null;
}

async function markMissingImage(productId: string): Promise<void> {
	const [product] = await db
		.select({ needsReview: products.needsReview, reviewReason: products.reviewReason })
		.from(products)
		.where(eq(products.id, productId))
		.limit(1);
	if (!product) return;

	const [existingImage] = await db
		.select({ id: productImages.id })
		.from(productImages)
		.where(eq(productImages.productId, productId))
		.limit(1);

	if (existingImage) return;

	const reasons = product.reviewReason?.split(";").map((r) => r.trim()) ?? [];
	if (reasons.includes("Sin imagen")) return;
	reasons.push("Sin imagen");
	await db
		.update(products)
		.set({ needsReview: true, reviewReason: reasons.join("; ") })
		.where(eq(products.id, productId));
}

// ── Orphan cleanup ─────────────────────────────────

export async function cleanupOrphanedReports(): Promise<void> {
	await db
		.update(syncReports)
		.set({
			status: "failed",
			completedAt: new Date(),
			errorMessage: "Servidor reiniciado durante sync",
		})
		.where(eq(syncReports.status, "running"));
}

// ── Main sync ──────────────────────────────────────
export async function runSync(
	items: ScrapedItem[],
	trigger: "manual" | "automatic",
	jobId?: string,
	onProgress?: (data: { reportId: string } & SyncStats & { total: number }) => void,
): Promise<{ reportId: string; stats: SyncStats; startedAt: string }> {
	const stats: SyncStats = {
		processed: 0,
		created: 0,
		updated: 0,
		unchanged: 0,
		errors: 0,
		outOfStock: 0,
	};

	const [report] = await db
		.insert(syncReports)
		.values({ status: "running", trigger, jobId: jobId ?? null })
		.returning({ id: syncReports.id, startedAt: syncReports.startedAt });

	if (!report) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "No se pudo crear el reporte de sync",
		});
	}

	const reportId = report.id;
	const startedAt = report.startedAt.toISOString();

	try {
		// ── Filtrar IDs en lista negra ──────────────────
		const blacklisted = await db
			.select({ externalId: scrapingBlacklist.externalId })
			.from(scrapingBlacklist)
			.where(eq(scrapingBlacklist.source, PROVIDER_SOURCE));

		const blockedIds = new Set(blacklisted.map((b) => b.externalId));
		const filtered = items.filter((item) => !blockedIds.has(item.providerId));
		const skippedCount = items.length - filtered.length;

		if (skippedCount > 0) {
			logger
				.withMetadata({ reportId, skipped: skippedCount, total: items.length })
				.info(`Sync: ${skippedCount} items omitidos por lista negra`);
		}

		// ── Filtrar precios placeholder (9999, 99999…) y stock 0: no se procesan pero
		// se marcan como vistos para que no se consideren out-of-stock.
		const skipIds: string[] = [];
		const activeItems = filtered.filter((item) => {
			if (isPlaceholderPrice(item.rawPrice)) {
				skipIds.push(item.providerId);
				return false;
			}
			if (item.rawStock === 0) {
				skipIds.push(item.providerId);
				return false;
			}
			return true;
		});

		if (skipIds.length > 0) {
			logger
				.withMetadata({ reportId, count: skipIds.length })
				.info(`Sync: ${skipIds.length} items omitidos (placeholder o stock 0)`);
		}

		logger.withMetadata({ reportId, count: activeItems.length, trigger }).info("Sync iniciado");
		const scrapedIds = new Set([...activeItems.map((i) => i.providerId), ...skipIds]);
		const progressStep = Math.max(1, Math.floor(activeItems.length * 0.05));
		let lastProgress = 0;

		// Procesar items concurrentemente con p-limit para controlar carga de IA
		const limit = pLimit(AI_CONCURRENCY);
		const results = await Promise.allSettled(
			activeItems.map((item) =>
				limit(async () => {
					try {
						await processItem(item, reportId, stats);
					} catch (error) {
						const msg = error instanceof Error ? error.message : String(error);
						logger
							.withMetadata({ reportId, providerId: item.providerId, error: msg })
							.error("Error procesando item en sync");
						throw error;
					}
					// Emitir progreso cada 5% de items
					if (onProgress && stats.processed - lastProgress >= progressStep) {
						lastProgress = stats.processed;
						onProgress({ reportId, ...stats, total: activeItems.length });
					}
				}),
			),
		);

		for (const result of results) {
			if (result.status === "rejected") {
				stats.errors++;
				const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
				logger.withMetadata({ reportId, error: msg }).error("Error procesando item en sync");
			}
		}

		// Solo marcar out-of-stock en automatico (full scan)
		if (trigger === "automatic" && scrapedIds.size > 0) {
			stats.outOfStock = await markOutOfStock(scrapedIds, reportId);
		}

		await db
			.update(syncReports)
			.set({ status: "completed", stats, completedAt: new Date(), errorMessage: null })
			.where(eq(syncReports.id, reportId));

		logger.withMetadata({ reportId, ...stats }).info("Sync completado");

		return { reportId, stats, startedAt };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await db
			.update(syncReports)
			.set({
				status: "failed",
				stats,
				completedAt: new Date(),
				errorMessage: message.slice(0, 500),
			})
			.where(eq(syncReports.id, reportId));
		throw error;
	}
}

// ── Process item ───────────────────────────────────
async function processItem(item: ScrapedItem, reportId: string, stats: SyncStats): Promise<void> {
	const { providerId } = item;
	stats.processed++;

	const [existing] = await db
		.select({
			id: productProviders.id,
			productId: productProviders.productId,
			rawPrice: productProviders.rawPrice,
			rawStock: productProviders.rawStock,
			rawImageUrl: productProviders.rawImageUrl,
			rawImageHash: productProviders.rawImageHash,
		})
		.from(productProviders)
		.where(
			and(
				eq(productProviders.source, PROVIDER_SOURCE),
				eq(productProviders.externalId, providerId),
			),
		)
		.limit(1);

	if (existing) {
		const changed = await updateExistingProduct(existing.productId, existing, item, reportId);
		changed ? stats.updated++ : stats.unchanged++;
	} else {
		await createNewProduct(item, reportId);
		stats.created++;
	}
}

// ── Update existing ────────────────────────────────
async function updateExistingProduct(
	productId: string,
	existing: {
		id: string;
		rawPrice: string | null;
		rawStock: number | null;
		rawImageUrl: string | null;
		rawImageHash: string | null;
	},
	item: ScrapedItem,
	reportId: string,
): Promise<boolean> {
	// Leer valores actuales del PRODUCTO (no del provider, que siempre está bien)
	const [product] = await db
		.select({ price: products.price, supplierPrice: products.supplierPrice, stock: products.stock })
		.from(products)
		.where(eq(products.id, productId))
		.limit(1);

	const currentPrice = product?.price ?? "0";
	const currentSupplierPrice = product?.supplierPrice ?? "0";
	const currentStock = product?.stock ?? 0;

	const pricing = await computePricingFromRules(item.rawPrice);
	const newStock = item.rawStock;

	// If the raw price is invalid, keep the existing supplier + sale price.
	// If valid, sync both: supplierPrice from raw, salePrice from tier rules.
	const nextSupplierPrice = pricing?.supplierPrice ?? currentSupplierPrice;
	const nextSalePrice = pricing?.salePrice ?? currentPrice;

	const priceChanged = currentPrice !== nextSalePrice;
	const stockChanged = currentStock !== newStock;
	const supplierChanged = currentSupplierPrice !== nextSupplierPrice;

	// Solo escribir si algo cambió (reduce churn en productChanges)
	if (supplierChanged || priceChanged || stockChanged) {
		await db
			.update(products)
			.set({
				supplierPrice: nextSupplierPrice,
				price: nextSalePrice,
				stock: newStock,
			})
			.where(eq(products.id, productId));
	}

	await db
		.update(productProviders)
		.set({
			rawPrice: item.rawPrice,
			rawStock: newStock,
			lastSyncAt: new Date(),
			lastSeenAt: new Date(),
			isUnavailable: false,
		})
		.where(eq(productProviders.id, existing.id));

	// ── Imagen ──────────────────────────────────────
	let imageChanged = false;
	const newImageUrl = await imageLimit(() => scrapingService.fetchProductImage(item.providerId));

	if (newImageUrl) {
		if (newImageUrl !== existing.rawImageUrl || !existing.rawImageHash) {
			imageChanged = true;

			const result = await processProductImage({
				productId,
				imageUrl: newImageUrl,
			});

			await db
				.update(productProviders)
				.set({ rawImageUrl: newImageUrl, rawImageHash: result.hash })
				.where(eq(productProviders.id, existing.id));

			await removeImageReviewReason(productId);

			await db.insert(productChanges).values({
				productId,
				syncReportId: reportId,
				source: "sync",
				changeType: "image_changed",
				field: "imagen",
				oldValue: existing.rawImageHash ? { hash: existing.rawImageHash } : { detectada: false },
				newValue: { hash: result.hash },
				reason: "Imagen del proveedor detectada o actualizada",
			});
		}
	} else if (existing.rawImageUrl) {
		await markMissingImage(productId);
	}

	if (!priceChanged && !stockChanged && !imageChanged) return false;

	if (priceChanged) {
		await db.insert(productChanges).values({
			productId,
			syncReportId: reportId,
			source: "sync",
			changeType: "price_changed",
			field: "raw_price",
			oldValue: { price: currentPrice },
			newValue: { price: nextSalePrice },
		});
	}

	if (stockChanged) {
		await db.insert(productChanges).values({
			productId,
			syncReportId: reportId,
			source: "sync",
			changeType: "stock_changed",
			field: "raw_stock",
			oldValue: { stock: currentStock },
			newValue: { stock: newStock },
		});
	}

	return true;
}

// ── Create new ─────────────────────────────────────
async function createNewProduct(item: ScrapedItem, reportId: string): Promise<void> {
	const { providerId, rawName, rawPrice, rawStock } = item;

	const [existingBrands, existingCategories] = await Promise.all([
		db.select({ name: brands.name }).from(brands).where(eq(brands.isActive, true)),
		db.select({ name: categories.name }).from(categories).where(eq(categories.isActive, true)),
	]);

	const blockedCategories = new Set(["Componentes", "Equipos", "Perifericos"]);

	const aiResult = await extractFromRawName(rawName.replace(/\s+/g, " "), {
		brands: existingBrands.map((b) => b.name),
		categories: existingCategories.map((c) => c.name).filter((n) => !blockedCategories.has(n)),
	});

	const baseSlug = makeSlug(aiResult.name);
	const slug = await ensureUniqueSlug(baseSlug, providerId);
	const brandId = await findOrCreateBrand(aiResult.brand);
	const categoryId = await findOrCreateCategory(aiResult.category);
	const pricing = await computePricingFromRules(rawPrice);
	const sku = makeSku(providerId);
	const imageUrl = await imageLimit(() => scrapingService.fetchProductImage(providerId));

	const reviewReasons: string[] = [];
	if (!brandId) reviewReasons.push("Sin marca");
	if (!categoryId) reviewReasons.push("Sin categoria");
	if (!imageUrl) reviewReasons.push("Sin imagen");
	if (aiResult.needsReview) reviewReasons.push("IA no confia en datos");

	const [product] = await db
		.insert(products)
		.values({
			name: aiResult.name,
			slug,
			sku,
			price: pricing?.salePrice ?? "0.00",
			supplierPrice: pricing?.supplierPrice ?? "0",
			roleCustomMargins: null,
			stock: rawStock,
			description: aiResult.description || null,
			specifications: aiResult.specifications,
			brandId,
			categoryId,
			isActive: true,
			needsReview: reviewReasons.length > 0,
			reviewReason: reviewReasons.length > 0 ? reviewReasons.join("; ") : null,
		})
		.returning({ id: products.id });

	if (!product) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: `No se pudo crear el producto del proveedor ${providerId}`,
			metadata: { providerId },
		});
	}

	await db.insert(productProviders).values({
		productId: product.id,
		source: PROVIDER_SOURCE,
		externalId: providerId,
		rawName,
		rawPrice,
		rawStock,
		rawImageUrl: imageUrl,
		rawImageHash: null,
		lastSyncAt: new Date(),
		lastSeenAt: new Date(),
		needsReview: aiResult.needsReview,
		reviewReason: aiResult.needsReview ? "Producto nuevo - revisar datos extraidos por IA" : null,
	});

	await db.insert(productChanges).values({
		productId: product.id,
		syncReportId: reportId,
		source: "sync",
		changeType: "created",
		reason: `Producto creado desde ${PROVIDER_SOURCE}`,
	});

	// ── Procesar imagen INLINE para productos nuevos ──
	if (imageUrl) {
		try {
			const result = await processProductImage({ productId: product.id, imageUrl });
			await db
				.update(productProviders)
				.set({ rawImageHash: result.hash })
				.where(eq(productProviders.productId, product.id));
		} catch (error) {
			logger
				.withError(error)
				.withMetadata({ productId: product.id })
				.warn("Error al procesar imagen en creación, se reintentará en próximo sync");
		}
	}
}

// ── Mark out of stock ──────────────────────────────
async function markOutOfStock(scrapedProviderIds: Set<string>, reportId: string): Promise<number> {
	const active = await db
		.select({ productId: productProviders.productId, providerId: productProviders.externalId })
		.from(productProviders)
		.where(
			and(eq(productProviders.source, PROVIDER_SOURCE), eq(productProviders.isUnavailable, false)),
		);

	const toMark = active.filter((p) => !scrapedProviderIds.has(p.providerId));

	if (toMark.length === 0) return 0;

	const productIds = toMark.map((p) => p.productId);

	await db.update(products).set({ stock: 0 }).where(inArray(products.id, productIds));

	await db
		.update(productProviders)
		.set({ isUnavailable: true })
		.where(
			and(
				eq(productProviders.source, PROVIDER_SOURCE),
				inArray(
					productProviders.externalId,
					toMark.map((p) => p.providerId),
				),
			),
		);

	await db.insert(productChanges).values(
		toMark.map((p) => ({
			productId: p.productId,
			syncReportId: reportId,
			source: "sync",
			changeType: "out_of_stock",
			reason: "Producto ya no listado por el proveedor",
		})),
	);

	return toMark.length;
}
