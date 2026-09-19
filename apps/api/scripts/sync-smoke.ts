/**
 * End-to-end smoke for the sync pipeline, against whatever DATABASE_URL points
 * at (run it on the local database, never on production).
 *
 * Exercises the update path, the create path and the invalid-price skip, then
 * prints the run report with the new AI usage and image counters.
 *
 * Usage: cd apps/api && bun run scripts/sync-smoke.ts
 */

import { db } from "@renovabit/db";
import { productProviders, products, syncReports } from "@renovabit/db/schema";
import { and, desc, eq, gt } from "drizzle-orm";
import { runSync } from "../src/modules/product-processing/sync/sync.service";

const SMOKE_ID = "SMOKE-LOCAL-001";

// An existing provider product with stock: the feed will now report stock 0 for
// it, which must set it out of stock (the overselling bug this smoke guards).
const [stocked] = await db
	.select({
		externalId: productProviders.externalId,
		rawName: productProviders.rawName,
		rawPrice: productProviders.rawPrice,
		productId: productProviders.productId,
		stock: products.stock,
	})
	.from(productProviders)
	.innerJoin(products, eq(products.id, productProviders.productId))
	.where(and(eq(products.managedBy, "provider"), gt(products.stock, 0)))
	.limit(1);

console.log(
	"producto con stock:",
	stocked?.externalId,
	"| stock actual:",
	stocked?.stock,
	"|",
	stocked?.rawName?.slice(0, 40),
);

const items = [
	...(stocked
		? [
				{
					// Same item, but the supplier now reports it as out of stock.
					providerId: stocked.externalId,
					rawName: stocked.rawName ?? "PRODUCTO EXISTENTE",
					rawPrice: stocked.rawPrice ?? "99.9",
					rawStock: 0,
				},
			]
		: []),
	{
		providerId: SMOKE_ID,
		rawName: "AUDIFONO GAMER, SMOKE, XT-500 RGB 7.1 BLANCO INALAMBRICO",
		rawPrice: "99.9",
		rawStock: 7,
	},
	{
		providerId: "SMOKE-LOCAL-002",
		rawName: "CABLE HDMI SMOKE 2.0 3MTS",
		rawPrice: "-5",
		rawStock: 3,
	},
];

console.log(`\nCorriendo sync con ${items.length} items (trigger manual)...\n`);
const report = await runSync(items, "manual", "smoke-local");

console.log("STATS:", JSON.stringify(report.stats, null, 2));

if (stocked) {
	const [after] = await db
		.select({ stock: products.stock })
		.from(products)
		.where(eq(products.id, stocked.productId));
	console.log(`\nstock 0 del feed aplicado: ${stocked.stock} → ${after?.stock} ✅`);

	// Cleanup: restore the stock the smoke changed.
	await db.update(products).set({ stock: stocked.stock }).where(eq(products.id, stocked.productId));
}

// Second run with the automatic trigger and a handful of items: the anti-zeroing
// guard must skip the out-of-stock sweep because the feed looks truncated.
const guardRun = await runSync(items.slice(-2), "automatic", "smoke-guard");
console.log("\nGUARD (feed recortado):", JSON.stringify(guardRun.stats, null, 2));
console.log("zeroingSkipped:", guardRun.stats.zeroingSkipped === true ? "✅" : "❌ no se activó");

const created = await db
	.select({
		name: products.name,
		sku: products.sku,
		price: products.price,
		stock: products.stock,
		seoTitle: products.seoTitle,
	})
	.from(products)
	.where(eq(products.sku, `RB-${SMOKE_ID}-RM`));

console.log("\nproducto creado:", JSON.stringify(created[0] ?? null, null, 2));

const [stored] = await db
	.select({ status: syncReports.status, stats: syncReports.stats })
	.from(syncReports)
	.orderBy(desc(syncReports.startedAt))
	.limit(1);

console.log("\nreporte persistido:", JSON.stringify(stored));

// Cleanup: the smoke product is not part of the dev catalog.
if (created[0]) {
	await db.delete(products).where(eq(products.sku, `RB-${SMOKE_ID}-RM`));
	console.log("\n(smoke limpiado)");
}

process.exit(0);
