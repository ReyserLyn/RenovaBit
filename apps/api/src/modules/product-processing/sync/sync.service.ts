import { db } from "@renovabit/db";
import {
	brands,
	categories,
	productChanges,
	productProviders,
	products,
	syncReports,
} from "@renovabit/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import pLimit from "p-limit";
import slugify from "slugify";
import type { ScrapedItem } from "@/modules/scrapping/model";
import { logger } from "@/utils/logger";
import { extractFromRawName } from "../ai/ai.service";
import type { SyncStats } from "./sync.model";

const PROVIDER_SOURCE = "rematazo";
const MARKUP = 1.1;
const AI_CONCURRENCY = 5;

function makeSlug(value: string): string {
	return slugify(value, { lower: true, strict: true, trim: true });
}

function makeSku(providerId: string): string {
	return `RB-${providerId}-RM`;
}

function applyMarkup(rawPrice: string): string {
	return (Number.parseFloat(rawPrice) * MARKUP).toFixed(2);
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

	if (!report) throw new Error("No se pudo crear el reporte de sync");

	const reportId = report.id;
	const startedAt = report.startedAt.toISOString();
	const scrapedIds = new Set(items.map((i) => i.providerId));
	const progressStep = Math.max(1, Math.floor(items.length * 0.05)); // 5%
	let lastProgress = 0;

	// Procesar items concurrentemente con p-limit para controlar carga de IA
	const limit = pLimit(AI_CONCURRENCY);
	const results = await Promise.allSettled(
		items.map((item) =>
			limit(async () => {
				await processItem(item, reportId, stats);
				// Emitir progreso cada 5% de items
				if (onProgress && stats.processed - lastProgress >= progressStep) {
					lastProgress = stats.processed;
					onProgress({ reportId, ...stats, total: items.length });
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
		.set({ status: "completed", stats, completedAt: new Date() })
		.where(eq(syncReports.id, reportId));

	return { reportId, stats, startedAt };
}

async function processItem(item: ScrapedItem, reportId: string, stats: SyncStats): Promise<void> {
	const { providerId } = item;
	stats.processed++;

	const [existing] = await db
		.select({
			id: productProviders.id,
			productId: productProviders.productId,
			rawPrice: productProviders.rawPrice,
			rawStock: productProviders.rawStock,
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
		if (changed) {
			stats.updated++;
		} else {
			stats.unchanged++;
		}
	} else {
		await createNewProduct(item, reportId);
		stats.created++;
	}
}

async function updateExistingProduct(
	productId: string,
	existing: { id: string; rawPrice: string | null; rawStock: number | null },
	item: ScrapedItem,
	reportId: string,
): Promise<boolean> {
	// Leer valores actuales del PRODUCTO (no del provider, que siempre está bien)
	const [product] = await db
		.select({ price: products.price, stock: products.stock })
		.from(products)
		.where(eq(products.id, productId))
		.limit(1);

	const currentPrice = product?.price;
	const currentStock = product?.stock ?? 0;

	const newPrice = applyMarkup(item.rawPrice);
	const newStock = item.rawStock;

	const priceChanged = currentPrice !== newPrice;
	const stockChanged = currentStock !== newStock;

	// Siempre sincronizar
	await db
		.update(products)
		.set({ price: newPrice, stock: newStock })
		.where(eq(products.id, productId));

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

	if (!priceChanged && !stockChanged) return false;

	if (priceChanged) {
		await db.insert(productChanges).values({
			productId,
			syncReportId: reportId,
			source: "sync",
			changeType: "price_changed",
			field: "raw_price",
			oldValue: { price: currentPrice },
			newValue: { price: newPrice },
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

async function createNewProduct(item: ScrapedItem, reportId: string): Promise<void> {
	const { providerId, rawName, rawPrice, rawStock } = item;

	const [existingBrands, existingCategories] = await Promise.all([
		db.select({ name: brands.name }).from(brands).where(eq(brands.isActive, true)),
		db.select({ name: categories.name }).from(categories).where(eq(categories.isActive, true)),
	]);

	const aiResult = await extractFromRawName(rawName.replace(/\s+/g, " "), {
		brands: existingBrands.map((b) => b.name),
		categories: existingCategories.map((c) => c.name),
	});

	const baseSlug = makeSlug(aiResult.name);
	const slug = await ensureUniqueSlug(baseSlug, providerId);
	const brandId = await findOrCreateBrand(aiResult.brand);
	const categoryId = await findOrCreateCategory(aiResult.category);
	const price = applyMarkup(rawPrice);
	const sku = makeSku(providerId);

	const [product] = await db
		.insert(products)
		.values({
			name: aiResult.name,
			slug,
			sku,
			price,
			stock: rawStock,
			description: aiResult.description || null,
			specifications: aiResult.specifications,
			brandId,
			categoryId,
			isActive: true,
		})
		.returning({ id: products.id });

	if (!product) throw new Error(`No se pudo crear producto ${providerId}`);

	await db.insert(productProviders).values({
		productId: product.id,
		source: PROVIDER_SOURCE,
		externalId: providerId,
		rawName,
		rawPrice,
		rawStock,
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
}

async function markOutOfStock(scrapedProviderIds: Set<string>, reportId: string): Promise<number> {
	const active = await db
		.select({
			productId: productProviders.productId,
			providerId: productProviders.externalId,
		})
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

	for (const p of toMark) {
		await db.insert(productChanges).values({
			productId: p.productId,
			syncReportId: reportId,
			source: "sync",
			changeType: "out_of_stock",
			reason: "Producto ya no listado por el proveedor",
		});
	}

	return toMark.length;
}
