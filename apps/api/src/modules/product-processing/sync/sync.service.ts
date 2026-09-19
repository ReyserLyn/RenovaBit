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
import { and, eq, inArray, sql } from "drizzle-orm";
import pLimit from "p-limit";
import slugify from "slugify";
import type { ScrapedItem } from "@/modules/scrapping/model";
import { scrapingService } from "@/modules/scrapping/service";
import { logger } from "@/utils/logger";
import { getActiveMarginRules } from "@/utils/margin-rules";
import { buildProductSeo } from "@/utils/product-seo";
import { addReviewReason, hasReviewReason, REVIEW_REASONS } from "@/utils/review-reasons";
import { deleteEntityFolder } from "@/utils/storage/helpers";
import { extractFromRawName } from "../ai/ai.service";
import { estimateCostUsd } from "../ai/pricing";
import { buildCategoryContext, type CategoryContext } from "../ai/prompts";
import { processProductImage, removeImageReviewReason } from "../image-pipeline/process";
import { isInvalidFeedPrice, parseFeedPrice } from "./feed-price";
import { shouldCheckProviderImage } from "./image-policy";
import { suffixProductName } from "./product-name";
import type { SyncStats } from "./sync.model";

type MarginRules = Awaited<ReturnType<typeof getActiveMarginRules>>;

/**
 * Data loaded once per run instead of once per item. The old code re-read every
 * brand and category for each new product and the margin rules for each item,
 * which is an N+1 across the whole feed.
 */
interface SyncContext {
	marginRules: MarginRules;
	brands: string[];
	categories: CategoryContext[];
}

/** The report carries the first failures only: enough to diagnose, small row. */
const MAX_FAILED_ITEMS = 25;

/**
 * Guard against a truncated feed zeroing the whole catalog: if the scraper only
 * parsed a fraction of the rows (HTML change, partial response), marking what was
 * not seen as out of stock would empty the storefront. Below this ratio the
 * sweep is skipped and reported instead.
 */
const MIN_SEEN_RATIO = 0.5;

async function countActiveProviders(): Promise<number> {
	const [row] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(productProviders)
		.where(
			and(eq(productProviders.source, PROVIDER_SOURCE), eq(productProviders.isUnavailable, false)),
		);
	return row?.count ?? 0;
}

/**
 * A provider id blocked while the run was in flight must not survive it: the
 * blacklist is read once at the start, so a product created after that read
 * would stay alive (and visible) until the next run.
 */
async function reconcileBlacklisted(reportId: string): Promise<number> {
	const blocked = await db
		.select({ externalId: scrapingBlacklist.externalId })
		.from(scrapingBlacklist)
		.where(eq(scrapingBlacklist.source, PROVIDER_SOURCE));
	if (blocked.length === 0) return 0;

	const doomed = await db
		.select({ productId: productProviders.productId })
		.from(productProviders)
		.where(
			and(
				eq(productProviders.source, PROVIDER_SOURCE),
				inArray(
					productProviders.externalId,
					blocked.map((row) => row.externalId),
				),
			),
		);
	if (doomed.length === 0) return 0;

	const deleted = await db
		.delete(products)
		.where(
			inArray(
				products.id,
				doomed.map((row) => row.productId),
			),
		)
		.returning({ id: products.id });

	for (const row of deleted) {
		deleteEntityFolder("products", row.id).catch((error) =>
			logger.withMetadata({ productId: row.id }).withError(error).warn("[R2 cleanup] falló"),
		);
	}

	logger
		.withMetadata({ reportId, deleted: deleted.length })
		.warn("Sync: productos de proveedores bloqueados eliminados al cerrar la corrida");

	return deleted.length;
}

function ensureAiStats(stats: SyncStats): NonNullable<SyncStats["ai"]> {
	stats.ai ??= { calls: 0, failed: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
	return stats.ai;
}

function ensureImageStats(stats: SyncStats): NonNullable<SyncStats["images"]> {
	stats.images ??= { checked: 0, processed: 0, missing: 0 };
	return stats.images;
}

function recordFailure(stats: SyncStats, providerId: string, error: unknown): void {
	const reason = (error instanceof Error ? error.message : String(error)).slice(0, 200);
	stats.failedItems ??= [];
	if (stats.failedItems.length < MAX_FAILED_ITEMS) {
		stats.failedItems.push({ providerId, reason });
	}
}

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
	rules: MarginRules,
): Promise<{ supplierPrice: string; salePrice: string } | null> {
	// Rejects unparseable, zero/negative and out-of-range (feed anomaly) prices.
	if (parseFeedPrice(rawPrice) === null) return null;

	const { salePrice } = getEffectiveSalePrice(
		{ supplierPrice: rawPrice, roleCustomMargins: null },
		"customer",
		rules,
	);

	return { supplierPrice: rawPrice, salePrice: salePrice.toFixed(2) };
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

/**
 * `products.name` is UNIQUE and the AI does not guarantee a distinct name per
 * listing: the same product re-listed under a new providerId (or two raws that
 * collapse into one name) would otherwise fail the insert on every sync forever.
 * Suffix the providerId so the row lands and a human can review the duplicate.
 */
async function ensureUniqueProductName(
	baseName: string,
	providerId: string,
): Promise<{ name: string; collided: boolean }> {
	const [existing] = await db
		.select({ id: products.id })
		.from(products)
		.where(eq(products.name, baseName))
		.limit(1);

	if (!existing) return { name: baseName, collided: false };

	return { name: suffixProductName(baseName, providerId), collided: true };
}

/**
 * Brand/category creation races under AI_CONCURRENCY: two items can miss on the
 * SELECT and then both INSERT, and the loser used to lose the whole product.
 * ON CONFLICT DO NOTHING + re-select keeps the concurrent item alive.
 */
async function findOrCreateBrand(name: string, context: SyncContext): Promise<string | null> {
	const cleanName = name?.trim();
	if (!cleanName) return null;

	const brandSlug = makeSlug(cleanName);
	if (!brandSlug) return null;

	const [existing] = await db
		.select({ id: brands.id })
		.from(brands)
		.where(eq(brands.slug, brandSlug))
		.limit(1);
	if (existing) return existing.id;

	const [created] = await db
		.insert(brands)
		.values({ name: cleanName, slug: brandSlug, isActive: true })
		.onConflictDoNothing({ target: brands.slug })
		.returning({ id: brands.id });
	if (created) {
		// Keep the run context fresh so later items see the new option.
		context.brands.push(cleanName);
		return created.id;
	}

	const [raced] = await db
		.select({ id: brands.id })
		.from(brands)
		.where(eq(brands.slug, brandSlug))
		.limit(1);
	return raced?.id ?? null;
}

async function findOrCreateCategory(name: string, context: SyncContext): Promise<string | null> {
	const cleanName = name?.trim();
	if (!cleanName) return null;

	const categorySlug = makeSlug(cleanName);
	if (!categorySlug) return null;

	const [existing] = await db
		.select({ id: categories.id })
		.from(categories)
		.where(eq(categories.slug, categorySlug))
		.limit(1);
	if (existing) {
		// A product never lands on a parent. The prompt only offers leaves, but if
		// the model returns an umbrella anyway the product goes to review instead
		// of silently sitting on a category the store cannot browse.
		const [child] = await db
			.select({ id: categories.id })
			.from(categories)
			.where(eq(categories.parentId, existing.id))
			.limit(1);
		if (child) return null;
		return existing.id;
	}

	const [created] = await db
		.insert(categories)
		.values({
			name: cleanName,
			slug: categorySlug,
			isActive: true,
			// Root leaf created by the sync: the materialized ancestor path is just
			// the root marker, and leaving it NULL breaks depth and breadcrumbs.
			path: "/",
		})
		.onConflictDoNothing({ target: categories.slug })
		.returning({ id: categories.id });
	if (created) {
		// New leaf: later items in this run can use it right away.
		context.categories.push({ name: cleanName, parent: null, leaf: true });
		return created.id;
	}

	const [raced] = await db
		.select({ id: categories.id })
		.from(categories)
		.where(eq(categories.slug, categorySlug))
		.limit(1);
	return raced?.id ?? null;
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
	if (hasReviewReason(product.reviewReason, REVIEW_REASONS.missingImage)) return;

	const reviewReason = addReviewReason(product.reviewReason, REVIEW_REASONS.missingImage);

	// The provider link mirrors the product's review state so the two never drift.
	await db.transaction(async (tx) => {
		await tx
			.update(products)
			.set({ needsReview: true, reviewReason })
			.where(eq(products.id, productId));
		await tx
			.update(productProviders)
			.set({ needsReview: true, reviewReason })
			.where(eq(productProviders.productId, productId));
	});
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

		// Items the supplier marks as not sellable: an out-of-range price or a
		// stock of 0 (oversold items arrive negative and the scraper clamps them).
		// Existing provider-managed products go out of stock keeping their price,
		// so they return to normal once the feed recovers; unseen items are not
		// created. Manual products are never touched by the feed.
		const skipIds: string[] = [];
		const unavailableIds: string[] = [];
		const activeItems = filtered.filter((item) => {
			if (isInvalidFeedPrice(item.rawPrice) || item.rawStock <= 0) {
				skipIds.push(item.providerId);
				unavailableIds.push(item.providerId);
				return false;
			}
			return true;
		});

		if (unavailableIds.length > 0) {
			const outOfStock = await db
				.update(products)
				.set({ stock: 0 })
				.where(
					and(
						eq(products.managedBy, "provider"),
						inArray(
							products.id,
							db
								.select({ id: productProviders.productId })
								.from(productProviders)
								.where(
									and(
										eq(productProviders.source, PROVIDER_SOURCE),
										inArray(productProviders.externalId, unavailableIds),
									),
								),
						),
					),
				)
				.returning({ id: products.id });

			stats.unavailableMarked = outOfStock.length;

			logger
				.withMetadata({
					reportId,
					productsOutOfStock: outOfStock.length,
					unavailableItems: unavailableIds.length,
				})
				.info("Sync: items no vendibles del proveedor → productos sin stock");
		}

		if (skipIds.length > 0) {
			logger
				.withMetadata({ reportId, count: skipIds.length })
				.info(`Sync: ${skipIds.length} items omitidos (precio inválido o stock 0)`);
		}

		logger.withMetadata({ reportId, count: activeItems.length, trigger }).info("Sync iniciado");
		const scrapedIds = new Set([...activeItems.map((i) => i.providerId), ...skipIds]);
		const progressStep = Math.max(1, Math.floor(activeItems.length * 0.05));
		let lastProgress = 0;

		// ── Catalog vocabulary and margin rules, once per run ──────────────
		const [marginRules, brandRows, categoryRows] = await Promise.all([
			getActiveMarginRules(),
			db.select({ name: brands.name }).from(brands).where(eq(brands.isActive, true)),
			db
				.select({ id: categories.id, name: categories.name, parentId: categories.parentId })
				.from(categories)
				.where(eq(categories.isActive, true)),
		]);
		const context: SyncContext = {
			marginRules,
			brands: brandRows.map((brand) => brand.name),
			categories: buildCategoryContext(categoryRows),
		};

		// Procesar items concurrentemente con p-limit para controlar carga de IA
		const limit = pLimit(AI_CONCURRENCY);
		const results = await Promise.allSettled(
			activeItems.map((item) =>
				limit(async () => {
					try {
						await processItem(item, reportId, stats, context);
					} catch (error) {
						// Keep the failure in the report: the counters alone made a
						// broken run indistinguishable from an empty feed.
						recordFailure(stats, item.providerId, error);
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

		// Solo marcar out-of-stock en automatico (full scan), y solo si el feed
		// llegó completo: un parseo parcial vaciaría el catálogo en silencio.
		if (trigger === "automatic" && scrapedIds.size > 0) {
			const activeProviders = await countActiveProviders();
			const seenRatio = activeProviders === 0 ? 1 : scrapedIds.size / activeProviders;

			if (seenRatio < MIN_SEEN_RATIO) {
				stats.zeroingSkipped = true;
				logger
					.withMetadata({ reportId, seen: scrapedIds.size, activeProviders, seenRatio })
					.error("Sync: el feed llegó incompleto → NO se marca out-of-stock");
			} else {
				stats.outOfStock = await markOutOfStock(scrapedIds, reportId);
			}
		}

		stats.blacklistedRemoved = await reconcileBlacklisted(reportId);
		stats.durationMs = Date.now() - new Date(startedAt).getTime();

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
async function processItem(
	item: ScrapedItem,
	reportId: string,
	stats: SyncStats,
	context: SyncContext,
): Promise<void> {
	const { providerId } = item;
	stats.processed++;

	const [existing] = await db
		.select({
			id: productProviders.id,
			productId: productProviders.productId,
			rawName: productProviders.rawName,
			rawPrice: productProviders.rawPrice,
			rawStock: productProviders.rawStock,
			rawImageUrl: productProviders.rawImageUrl,
			rawImageHash: productProviders.rawImageHash,
			imageCheckedAt: productProviders.imageCheckedAt,
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
		const changed = await updateExistingProduct(
			existing.productId,
			existing,
			item,
			reportId,
			stats,
			context,
		);
		changed ? stats.updated++ : stats.unchanged++;
	} else {
		await createNewProduct(item, reportId, stats, context);
		stats.created++;
	}
}

// ── Update existing ────────────────────────────────
async function updateExistingProduct(
	productId: string,
	existing: {
		id: string;
		rawName: string | null;
		rawPrice: string | null;
		rawStock: number | null;
		rawImageUrl: string | null;
		rawImageHash: string | null;
		imageCheckedAt: Date | null;
	},
	item: ScrapedItem,
	reportId: string,
	stats: SyncStats,
	context: SyncContext,
): Promise<boolean> {
	// Leer valores actuales del PRODUCTO (no del provider, que siempre está bien)
	const [product] = await db
		.select({
			price: products.price,
			supplierPrice: products.supplierPrice,
			stock: products.stock,
			managedBy: products.managedBy,
		})
		.from(products)
		.where(eq(products.id, productId))
		.limit(1);

	const currentPrice = product?.price ?? "0";
	const currentSupplierPrice = product?.supplierPrice ?? "0";
	const currentStock = product?.stock ?? 0;

	// Owner-managed products: the feed never overwrites stock or price.
	const isManual = product?.managedBy === "manual";

	const pricing = await computePricingFromRules(item.rawPrice, context.marginRules);
	// Defense in depth: the feed can report negative availability.
	const newStock = Math.max(0, item.rawStock);

	// If the raw price is invalid, keep the existing supplier + sale price.
	// If valid, sync both: supplierPrice from raw, salePrice from tier rules.
	const nextSupplierPrice = pricing?.supplierPrice ?? currentSupplierPrice;
	const nextSalePrice = pricing?.salePrice ?? currentPrice;

	const priceChanged = !isManual && currentPrice !== nextSalePrice;
	const stockChanged = !isManual && currentStock !== newStock;
	const supplierChanged = !isManual && currentSupplierPrice !== nextSupplierPrice;

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

	// El proveedor puede corregir el título en el feed. El raw guardado es la
	// entrada del re-enriquecimiento con IA, así que se refresca siempre y se
	// deja el evento para que ese proceso repase justo los corregidos.
	if (item.rawName !== existing.rawName) {
		await db
			.update(productProviders)
			.set({ rawName: item.rawName })
			.where(eq(productProviders.id, existing.id));

		await db.insert(productChanges).values({
			productId,
			syncReportId: reportId,
			source: "sync",
			changeType: "raw_name_changed",
			field: "raw_name",
			oldValue: { rawName: existing.rawName },
			newValue: { rawName: item.rawName },
			reason: "El proveedor actualizó el título en el feed",
		});
	}

	// ── Imagen ──────────────────────────────────────
	// Re-checked on a schedule, not on every run: the feed URL is deterministic,
	// so a plain re-fetch can only detect a *removed* image, and doing it for
	// every product every ten minutes hammered the supplier for nothing.
	let imageChanged = false;

	if (
		shouldCheckProviderImage({
			rawImageUrl: existing.rawImageUrl,
			rawImageHash: existing.rawImageHash,
			imageCheckedAt: existing.imageCheckedAt,
		})
	) {
		const images = ensureImageStats(stats);
		images.checked++;

		const newImageUrl = await imageLimit(() => scrapingService.fetchProductImage(item.providerId));
		const checkedAt = new Date();

		if (newImageUrl) {
			if (newImageUrl !== existing.rawImageUrl || !existing.rawImageHash) {
				imageChanged = true;
				const result = await processProductImage({ productId, imageUrl: newImageUrl });

				await db
					.update(productProviders)
					.set({ rawImageUrl: newImageUrl, rawImageHash: result.hash, imageCheckedAt: checkedAt })
					.where(eq(productProviders.id, existing.id));

				await removeImageReviewReason(productId);
				images.processed++;

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
			} else {
				await db
					.update(productProviders)
					.set({ imageCheckedAt: checkedAt })
					.where(eq(productProviders.id, existing.id));
			}
		} else {
			// The supplier removed the image: record the check so it is not
			// hammered again until the next window.
			await db
				.update(productProviders)
				.set({ imageCheckedAt: checkedAt })
				.where(eq(productProviders.id, existing.id));

			if (existing.rawImageUrl) {
				await markMissingImage(productId);
				images.missing++;
			}
		}
	}

	if (!priceChanged && !stockChanged && !imageChanged && !supplierChanged) return false;

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

	if (supplierChanged) {
		// The cost moved without moving the sale price: still a change worth
		// auditing, otherwise the run reports "unchanged" while the row changed.
		await db.insert(productChanges).values({
			productId,
			syncReportId: reportId,
			source: "sync",
			changeType: "supplier_price_changed",
			field: "supplier_price",
			oldValue: { supplierPrice: currentSupplierPrice },
			newValue: { supplierPrice: nextSupplierPrice },
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
async function createNewProduct(
	item: ScrapedItem,
	reportId: string,
	stats: SyncStats,
	context: SyncContext,
): Promise<void> {
	const { providerId, rawName, rawPrice, rawStock } = item;

	// Catalog vocabulary and margin rules come from the run context: reading
	// every brand and category per product was the sync's N+1.
	const ai = ensureAiStats(stats);
	ai.calls++;

	let extraction: Awaited<ReturnType<typeof extractFromRawName>>;
	try {
		extraction = await extractFromRawName(rawName, {
			brands: context.brands,
			categories: context.categories,
		});
	} catch (error) {
		ai.failed++;
		throw error;
	}

	ai.inputTokens += extraction.usage.inputTokens;
	ai.outputTokens += extraction.usage.outputTokens;
	ai.costUsd = estimateCostUsd({ inputTokens: ai.inputTokens, outputTokens: ai.outputTokens });

	const aiResult = extraction.output;

	const { name: productName, collided: nameCollided } = await ensureUniqueProductName(
		aiResult.name,
		providerId,
	);
	const baseSlug = makeSlug(productName);
	const slug = await ensureUniqueSlug(baseSlug, providerId);
	const brandId = await findOrCreateBrand(aiResult.brand, context);
	const categoryId = await findOrCreateCategory(aiResult.category, context);
	const pricing = await computePricingFromRules(rawPrice, context.marginRules);
	const sku = makeSku(providerId);

	const images = ensureImageStats(stats);
	images.checked++;
	const imageUrl = await imageLimit(() => scrapingService.fetchProductImage(providerId));
	if (!imageUrl) images.missing++;

	const reviewReasons: string[] = [];
	if (!brandId) reviewReasons.push("Sin marca");
	if (!categoryId) reviewReasons.push("Sin categoria");
	if (!imageUrl) reviewReasons.push("Sin imagen");
	if (!pricing) reviewReasons.push("Precio inválido o fuera de rango");
	if (aiResult.needsReview) reviewReasons.push("IA no confia en datos");
	if (nameCollided) reviewReasons.push("Posible duplicado");

	// SEO meta is derived from the catalog data, never written by the model.
	const seo = buildProductSeo({
		name: productName,
		brandName: aiResult.brand,
		categoryName: aiResult.category,
		specifications: aiResult.specifications,
	});

	// One transaction: a half-created product (a row without its provider link)
	// can never be reconciled by a later sync — it would only fight the UNIQUE
	// name forever. Image processing stays outside: it is slow and external.
	const product = await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(products)
			.values({
				name: productName,
				slug,
				sku,
				price: pricing?.salePrice ?? "0.00",
				supplierPrice: pricing?.supplierPrice ?? "0",
				roleCustomMargins: null,
				stock: Math.max(0, rawStock),
				description: aiResult.description || null,
				specifications: aiResult.specifications,
				brandId,
				categoryId,
				isActive: true,
				needsReview: reviewReasons.length > 0,
				reviewReason: reviewReasons.length > 0 ? reviewReasons.join("; ") : null,
				seoTitle: seo.seoTitle,
				seoDescription: seo.seoDescription,
				seoKeywords: seo.seoKeywords,
			})
			.returning({ id: products.id });

		if (!created) {
			throw createApiError({
				code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
				message: `No se pudo crear el producto del proveedor ${providerId}`,
				metadata: { providerId },
			});
		}

		await tx.insert(productProviders).values({
			productId: created.id,
			source: PROVIDER_SOURCE,
			externalId: providerId,
			rawName,
			rawPrice,
			rawStock,
			rawImageUrl: imageUrl,
			rawImageHash: null,
			imageCheckedAt: imageUrl ? new Date() : null,
			lastSyncAt: new Date(),
			lastSeenAt: new Date(),
			needsReview: reviewReasons.length > 0,
			reviewReason: reviewReasons.length > 0 ? reviewReasons.join("; ") : null,
		});

		await tx.insert(productChanges).values({
			productId: created.id,
			syncReportId: reportId,
			source: "sync",
			changeType: "created",
			reason: `Producto creado desde ${PROVIDER_SOURCE}`,
		});

		return created;
	});

	// ── Procesar imagen INLINE para productos nuevos ──
	if (imageUrl) {
		try {
			const result = await processProductImage({ productId: product.id, imageUrl });
			await db
				.update(productProviders)
				.set({ rawImageHash: result.hash })
				.where(eq(productProviders.productId, product.id));
			images.processed++;
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
		.select({
			productId: productProviders.productId,
			providerId: productProviders.externalId,
			managedBy: products.managedBy,
		})
		.from(productProviders)
		.innerJoin(products, eq(products.id, productProviders.productId))
		.where(
			and(eq(productProviders.source, PROVIDER_SOURCE), eq(productProviders.isUnavailable, false)),
		);

	// Owner-managed products never get zeroed by the feed.
	const toMark = active.filter(
		(p) => !scrapedProviderIds.has(p.providerId) && p.managedBy !== "manual",
	);

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
