/**
 * SEO backfill (sweep phase 3).
 *
 * Fills seoTitle / seoDescription / seoKeywords for products that do not have
 * them yet, generated deterministically from stored data (name, brand,
 * category, specifications). No AI calls: nothing is invented, and the whole
 * catalog can be regenerated in seconds at zero cost.
 *
 * Usage (from apps/api):
 *   bun run scripts/sweep/seo.ts                 # dry-run
 *   bun run scripts/sweep/seo.ts --all           # dry-run, regenerate everything
 *   SWEEP_CONFIRM=yes bun run scripts/sweep/seo.ts --apply
 */

import { db } from "@renovabit/db";
import { brands, categories, products } from "@renovabit/db/schema";
import { eq, isNull, or, sql } from "drizzle-orm";
import { buildProductSeo } from "@/utils/product-seo";

const APPLY = process.argv.includes("--apply");
const ALL = process.argv.includes("--all");
if (APPLY && process.env.SWEEP_CONFIRM !== "yes") {
	console.error("Falta SWEEP_CONFIRM=yes para escribir en la base de datos.");
	process.exit(1);
}

const BATCH_SIZE = 200;

interface Row {
	id: string;
	name: string;
	brandName: string | null;
	categoryName: string | null;
	specifications: Array<{ id: string; key: string; value: string }> | null;
}

async function main() {
	const rows = (await db
		.select({
			id: products.id,
			name: products.name,
			brandName: brands.name,
			categoryName: categories.name,
			specifications: products.specifications,
		})
		.from(products)
		.leftJoin(brands, eq(brands.id, products.brandId))
		.leftJoin(categories, eq(categories.id, products.categoryId))
		.where(ALL ? sql`true` : or(isNull(products.seoTitle), eq(products.seoTitle, "")))) as Row[];

	console.log(
		`[sweep/seo] ${APPLY ? "APLICANDO" : "DRY-RUN"} · ${rows.length} productos ${ALL ? "(regenerando todos)" : "sin SEO"}\n`,
	);

	const updates = rows.map((row) => ({
		id: row.id,
		...buildProductSeo({
			name: row.name,
			brandName: row.brandName,
			categoryName: row.categoryName,
			specifications: row.specifications,
		}),
	}));

	for (const sample of updates.slice(0, 5)) {
		const row = rows.find((candidate) => candidate.id === sample.id);
		console.log(`- ${row?.name}`);
		console.log(`  title: ${sample.seoTitle}`);
		console.log(`  desc:  ${sample.seoDescription}`);
		console.log(`  keys:  ${sample.seoKeywords}\n`);
	}

	if (!APPLY) {
		console.log(
			`(dry-run: ${updates.length} productos listos. Agrega --apply y SWEEP_CONFIRM=yes)`,
		);
		return;
	}

	let written = 0;
	for (let offset = 0; offset < updates.length; offset += BATCH_SIZE) {
		const batch = updates.slice(offset, offset + BATCH_SIZE);
		const values = batch.map(
			(item) =>
				sql`(${item.id}::uuid, ${item.seoTitle}::text, ${item.seoDescription}::text, ${item.seoKeywords}::text)`,
		);

		await db.execute(sql`
			UPDATE products
			SET seo_title = v.title,
				seo_description = v.description,
				seo_keywords = v.keywords,
				updated_at = now()
			FROM (VALUES ${sql.join(values, sql`, `)}) AS v(id, title, description, keywords)
			WHERE products.id = v.id
		`);

		written += batch.length;
		console.log(`   ... ${written}/${updates.length}`);
	}

	console.log(`\n[sweep/seo] ${written} productos actualizados con SEO.`);
}

await main();
process.exit(0);
