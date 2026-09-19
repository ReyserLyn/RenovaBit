/**
 * AI re-enrichment sweep (phase 2).
 *
 * Re-runs the extraction prompt over each product's stored supplier raw name
 * and rewrites the fields the AI owns: name, description, specifications,
 * brand, category and the derived SEO. Price, stock, managed_by, SKU, slug and
 * images are never touched.
 *
 * Every write is audited in `product_changes` with the old value, so a whole
 * batch can be reverted. Dry-run by default.
 *
 * Usage (from apps/api):
 *   bun run scripts/sweep/ai.ts --limit=40                    # dry-run
 *   SWEEP_CONFIRM=yes bun run scripts/sweep/ai.ts --apply --limit=200
 *   SWEEP_CONFIRM=yes bun run scripts/sweep/ai.ts --revert=sweep-ai-2026-09-19
 */

import { db } from "@renovabit/db";
import {
	brands,
	categories,
	productChanges,
	productProviders,
	products,
} from "@renovabit/db/schema";
import { and, eq, sql } from "drizzle-orm";
import pLimit from "p-limit";
import { extractFromRawName } from "@/modules/product-processing/ai/ai.service";
import {
	buildCategoryContext,
	type CategoryContext,
} from "@/modules/product-processing/ai/prompts";
import { makeSlug } from "@/utils/db-helpers";
import { buildProductSeo } from "@/utils/product-seo";

const args = Object.fromEntries(
	process.argv.slice(2).map((arg) => {
		const [key, value = ""] = arg.replace(/^--/, "").split("=");
		return [key, value];
	}),
);
const APPLY = args.apply !== undefined;
const REVERT = typeof args.revert === "string" && args.revert.length > 0 ? args.revert : null;
const LIMIT = Number(args.limit ?? 40);
const CONCURRENCY = 5;
const MARKER = `sweep-ai-${new Date().toISOString().slice(0, 10)}`;

if ((APPLY || REVERT) && process.env.SWEEP_CONFIRM !== "yes") {
	console.error("Falta SWEEP_CONFIRM=yes para escribir en la base de datos.");
	process.exit(1);
}

function slugOf(name: string): string {
	return makeSlug(name);
}

interface Candidate {
	productId: string;
	productName: string;
	rawName: string;
	providerId: string;
	brandId: string | null;
	categoryId: string | null;
	description: string | null;
	specifications: Array<{ id: string; key: string; value: string }> | null;
}

async function revert(marker: string) {
	const changes = await db
		.select({
			productId: productChanges.productId,
			oldValue: productChanges.oldValue,
			createdAt: productChanges.createdAt,
		})
		.from(productChanges)
		.where(and(eq(productChanges.changeType, "ai_sweep"), eq(productChanges.reason, marker)));

	console.log(`[sweep/ai] revert ${changes.length} productos del lote ${marker}`);

	let restored = 0;
	for (const change of changes) {
		const old = change.oldValue as Record<string, unknown> | null;
		if (!old) continue;
		await db
			.update(products)
			.set({
				name: old.name as string,
				description: (old.description as string | null) ?? null,
				specifications: old.specifications as Array<{ id: string; key: string; value: string }>,
				brandId: (old.brandId as string | null) ?? null,
				categoryId: (old.categoryId as string | null) ?? null,
				seoTitle: (old.seoTitle as string | null) ?? null,
				seoDescription: (old.seoDescription as string | null) ?? null,
				seoKeywords: (old.seoKeywords as string | null) ?? null,
			})
			.where(eq(products.id, change.productId));
		restored++;
	}

	console.log(`[sweep/ai] restaurados ${restored}`);
}

async function main() {
	if (REVERT) {
		await revert(REVERT);
		return;
	}

	const [brandRows, categoryRows] = await Promise.all([
		db.select({ id: brands.id, name: brands.name }).from(brands),
		db
			.select({ id: categories.id, name: categories.name, parentId: categories.parentId })
			.from(categories),
	]);
	const brandBySlug = new Map(brandRows.map((brand) => [slugOf(brand.name), brand]));
	const categoryBySlug = new Map(categoryRows.map((category) => [slugOf(category.name), category]));
	const context: CategoryContext[] = buildCategoryContext(categoryRows);

	const alreadySwept = await db
		.select({ productId: productChanges.productId })
		.from(productChanges)
		.where(eq(productChanges.reason, MARKER));
	const sweptIds = new Set(alreadySwept.map((row) => row.productId));

	const candidates = (await db
		.select({
			productId: products.id,
			productName: products.name,
			rawName: productProviders.rawName,
			providerId: productProviders.externalId,
			brandId: products.brandId,
			categoryId: products.categoryId,
			description: products.description,
			specifications: products.specifications,
		})
		.from(products)
		.innerJoin(productProviders, eq(productProviders.productId, products.id))
		.where(and(eq(products.managedBy, "provider"), eq(products.isActive, true)))
		.orderBy(
			sql`jsonb_array_length(coalesce(${products.specifications}, '[]'::jsonb)) asc, ${products.createdAt} asc`,
		)) as Candidate[];

	const pending = candidates
		.filter((candidate) => !sweptIds.has(candidate.productId) && candidate.rawName)
		.slice(0, LIMIT === 0 ? undefined : LIMIT);

	console.log(
		`[sweep/ai] ${APPLY ? "APLICANDO" : "DRY-RUN"} · ${pending.length} productos (${candidates.length} candidatos, ${sweptIds.size} ya barridos) · lote ${MARKER}\n`,
	);

	const limit = pLimit(CONCURRENCY);
	let changed = 0;
	let flagged = 0;
	let skipped = 0;
	const unrecognized: string[] = [];
	const createdBrands = new Set<string>();

	const results = await Promise.all(
		pending.map((candidate) =>
			limit(async () => {
				try {
					const { output: extraction } = await extractFromRawName(candidate.rawName, {
						brands: brandRows.map((brand) => brand.name),
						categories: context,
					});

					// Guard: a junk raw ("NO APLICA") makes the model return an empty
					// name. Writing that would destroy the product row, so skip it and
					// leave the product for manual review.
					if (extraction.name.trim().length < 3) {
						skipped++;
						if (!APPLY)
							unrecognized.push(`nombre vacío para raw "${candidate.rawName.slice(0, 30)}"`);
						return null;
					}

					const brand = brandBySlug.get(slugOf(extraction.brand));
					const category = categoryBySlug.get(slugOf(extraction.category));

					// In apply mode a brand the model inferred (exclusive product line)
					// but the catalog does not have yet is created, exactly like the sync
					// does for new products.
					let resolvedBrand = brand;
					if (APPLY && !brand && extraction.brand.trim()) {
						const brandName = extraction.brand.trim();
						const brandSlug = slugOf(brandName);
						const [created] = await db
							.insert(brands)
							.values({ name: brandName, slug: brandSlug, isActive: true })
							.onConflictDoNothing({ target: brands.slug })
							.returning({ id: brands.id, name: brands.name });
						if (created) {
							createdBrands.add(created.name);
							brandBySlug.set(brandSlug, created);
							resolvedBrand = created;
						} else {
							const [existing] = await db
								.select({ id: brands.id, name: brands.name })
								.from(brands)
								.where(eq(brands.slug, brandSlug))
								.limit(1);
							resolvedBrand = existing;
						}
					}
					const seo = buildProductSeo({
						name: extraction.name,
						brandName: brand?.name ?? extraction.brand,
						categoryName: category?.name ?? extraction.category,
						specifications: extraction.specifications,
					});

					const nameChanged = extraction.name !== candidate.productName;
					const specsChanged =
						JSON.stringify(extraction.specifications) !==
						JSON.stringify(candidate.specifications ?? []);
					const descriptionChanged = (extraction.description ?? null) !== candidate.description;
					const brandChanged = resolvedBrand ? resolvedBrand.id !== candidate.brandId : false;
					const categoryChanged = category ? category.id !== candidate.categoryId : false;
					const wouldChange =
						nameChanged || specsChanged || descriptionChanged || brandChanged || categoryChanged;

					if (!brand) {
						flagged++;
						if (!APPLY)
							unrecognized.push(`marca "${extraction.brand}" (${candidate.rawName.slice(0, 30)})`);
					}
					if (!category) {
						flagged++;
						if (!APPLY)
							unrecognized.push(
								`categoría "${extraction.category}" (${candidate.rawName.slice(0, 30)})`,
							);
					}
					if (wouldChange) changed++;

					if (!APPLY) {
						return {
							candidate,
							extraction,
							wouldChange,
							brand,
							category,
							seo,
							nameChanged,
							specsChanged,
							descriptionChanged,
							brandChanged,
							categoryChanged,
						};
					}

					if (!wouldChange) return null;

					// products.name is UNIQUE: if the improved name is already taken by
					// another product, suffix the provider id (same policy as the sync).
					let nextName = extraction.name;
					const [clash] = await db
						.select({ id: products.id })
						.from(products)
						.where(eq(products.name, nextName))
						.limit(1);
					if (clash && clash.id !== candidate.productId) {
						const suffix = ` (${candidate.providerId})`;
						nextName = `${nextName.slice(0, 255 - suffix.length)}${suffix}`;
					}

					await db.transaction(async (tx) => {
						await tx
							.update(products)
							.set({
								name: nextName,
								description: extraction.description || null,
								specifications: extraction.specifications,
								brandId: resolvedBrand?.id ?? candidate.brandId,
								categoryId: category?.id ?? candidate.categoryId,
								seoTitle: seo.seoTitle,
								seoDescription: seo.seoDescription,
								seoKeywords: seo.seoKeywords,
							})
							.where(eq(products.id, candidate.productId));

						await tx.insert(productChanges).values({
							productId: candidate.productId,
							source: "system",
							changeType: "ai_sweep",
							field: "nombre",
							oldValue: {
								name: candidate.productName,
								description: candidate.description,
								specifications: candidate.specifications ?? [],
								brandId: candidate.brandId,
								categoryId: candidate.categoryId,
							},
							newValue: {
								name: nextName,
								description: extraction.description,
								specifications: extraction.specifications,
								brandId: resolvedBrand?.id ?? null,
								categoryId: category?.id ?? null,
							},
							reason: MARKER,
						});
					});

					return null;
				} catch (error) {
					console.error(
						`   ⚠ ${candidate.productId} (${candidate.rawName.slice(0, 40)}): ${error instanceof Error ? error.message.slice(0, 80) : error}`,
					);
					return null;
				}
			}),
		),
	);

	if (!APPLY) {
		const shown = results.filter((result) => result?.wouldChange).slice(0, 12);
		for (const result of shown) {
			if (!result) continue;
			const { candidate, extraction } = result;
			console.log(`raw:  ${candidate.rawName}`);
			console.log(`antes: ${candidate.productName}`);
			console.log(`después: ${extraction.name}`);
			console.log(
				`specs: ${candidate.specifications?.length ?? 0} → ${extraction.specifications.length} | marca: ${extraction.brand || "-"} | categoria: ${extraction.category}`,
			);
			console.log(
				`seo:  ${result.seo.seoTitle}\n      ${result.seo.seoDescription}\n      ${result.seo.seoKeywords}\n`,
			);
		}
		if (unrecognized.length > 0) {
			console.log("\nAvisos:");
			for (const item of [...new Set(unrecognized)]) console.log(`   ⚠ ${item}`);
		}
		console.log(
			`\n[sweep/ai] DRY-RUN: ${changed} de ${pending.length} cambiarían algo · ${skipped} omitidos por nombre inválido · ${flagged} marcas/categorías no reconocidas`,
		);
		console.log("(nada escrito; agrega --apply y SWEEP_CONFIRM=yes)");
		return;
	}

	console.log(
		`\n[sweep/ai] ${changed} productos actualizados · ${flagged} avisos de marca/categoría`,
	);
	if (createdBrands.size > 0) {
		console.log(`marcas nuevas creadas: ${[...createdBrands].sort().join(", ")}`);
	}
}

await main();
process.exit(0);
