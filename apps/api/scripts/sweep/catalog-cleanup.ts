/**
 * Catalog cleanup: parent-category rules and navbar hygiene.
 *
 * Owner rules applied here:
 * - At most 4 root (parent) categories, and a root must have children.
 * - "Casa Inteligente" is dissolved: its only child ("Focos Smart") moves under
 *   "Equipos".
 * - "Antivirus" is deleted: its products went to the blacklist, so it has no
 *   products and no children.
 * - Brands and categories with 0 products stop showing in the navbar. They are
 *   deactivated, never deleted (the owner asked to keep the rows).
 *
 * Usage (from apps/api):
 *   bun run scripts/sweep/catalog-cleanup.ts
 *   SWEEP_CONFIRM=yes bun run scripts/sweep/catalog-cleanup.ts --apply
 */

import { db } from "@renovabit/db";
import { brands, categories, products } from "@renovabit/db/schema";
import { eq, sql } from "drizzle-orm";
import { makeSlug } from "@/utils/db-helpers";

const APPLY = process.argv.includes("--apply");
if (APPLY && process.env.SWEEP_CONFIRM !== "yes") {
	console.error("Falta SWEEP_CONFIRM=yes para escribir en la base de datos.");
	process.exit(1);
}

/** Brand names that are typos of the real brand. */
const BRAND_NAME_FIXES: Array<{ from: string; to: string }> = [{ from: "McAffe", to: "McAfee" }];

async function main() {
	console.log(`[sweep/cleanup] ${APPLY ? "APLICANDO" : "DRY-RUN"}\n`);

	const categoryRows = await db
		.select({ id: categories.id, name: categories.name, parentId: categories.parentId })
		.from(categories);
	const byName = new Map(categoryRows.map((row) => [row.name, row]));
	const childrenOf = new Map<string, number>();
	for (const row of categoryRows) {
		if (!row.parentId) continue;
		childrenOf.set(row.parentId, (childrenOf.get(row.parentId) ?? 0) + 1);
	}
	const productCount = new Map<string, number>();
	const counts = await db
		.select({ categoryId: products.categoryId, count: sql<number>`count(*)::int` })
		.from(products)
		.groupBy(products.categoryId);
	for (const row of counts) {
		if (row.categoryId) productCount.set(row.categoryId, row.count);
	}

	const deleted = new Set<string>();

	// ── 1. Move "Focos Smart" under "Equipos" ──────────────────────────────
	const focos = byName.get("Focos Smart");
	const equipos = byName.get("Equipos");
	if (focos && equipos && focos.parentId !== equipos.id) {
		console.log(`1) Mover "Focos Smart" → bajo "Equipos"`);
		if (APPLY) {
			await db.update(categories).set({ parentId: equipos.id }).where(eq(categories.id, focos.id));
		}
		// Keep the in-memory view in sync so later steps and the final check
		// describe the plan, not the pre-change state.
		if (focos.parentId) {
			childrenOf.set(focos.parentId, Math.max(0, (childrenOf.get(focos.parentId) ?? 1) - 1));
		}
		childrenOf.set(equipos.id, (childrenOf.get(equipos.id) ?? 0) + 1);
		focos.parentId = equipos.id;
	}

	// ── 2. Dissolve "Casa Inteligente" (no children left) ──────────────────
	const casa = byName.get("Casa Inteligente");
	if (casa && (childrenOf.get(casa.id) ?? 0) === 0 && (productCount.get(casa.id) ?? 0) === 0) {
		console.log(`2) Eliminar categoría padre vacía "Casa Inteligente"`);
		if (APPLY) await db.delete(categories).where(eq(categories.id, casa.id));
		deleted.add(casa.name);
	}

	// ── 3. Delete "Antivirus" (products blacklisted) ───────────────────────
	const antivirus = byName.get("Antivirus");
	if (
		antivirus &&
		(childrenOf.get(antivirus.id) ?? 0) === 0 &&
		(productCount.get(antivirus.id) ?? 0) === 0
	) {
		console.log(`3) Eliminar categoría vacía "Antivirus"`);
		if (APPLY) await db.delete(categories).where(eq(categories.id, antivirus.id));
		deleted.add(antivirus.name);
	}

	// ── 4. Brands: fix typos, delete the ones with no products ─────────────
	for (const fix of BRAND_NAME_FIXES) {
		const brand = (
			await db.select({ id: brands.id }).from(brands).where(eq(brands.name, fix.from)).limit(1)
		)[0];
		if (!brand) continue;
		console.log(`4) Corregir marca "${fix.from}" → "${fix.to}"`);
		if (APPLY) {
			await db
				.update(brands)
				.set({ name: fix.to, slug: makeSlug(fix.to) })
				.where(eq(brands.id, brand.id));
		}
	}

	// Owner policy: an empty brand is clutter, not history. Delete it (it gets
	// recreated automatically if the feed ever carries it again).
	const emptyBrands = await db
		.select({ id: brands.id, name: brands.name })
		.from(brands)
		.where(sql`NOT EXISTS (SELECT 1 FROM products p WHERE p.brand_id = ${brands.id})`);
	console.log(
		`\n4b) Borrar ${emptyBrands.length} marcas sin productos: ${emptyBrands.map((b) => b.name).join(", ") || "(ninguna)"}`,
	);
	if (APPLY && emptyBrands.length > 0) {
		for (const brand of emptyBrands) {
			await db.delete(brands).where(eq(brands.id, brand.id));
		}
	}

	// ── 5. Empty categories (no products, no children) are deleted too ─────
	const emptyLeaves = categoryRows.filter(
		(row) =>
			!deleted.has(row.name) &&
			(childrenOf.get(row.id) ?? 0) === 0 &&
			(productCount.get(row.id) ?? 0) === 0,
	);
	console.log(
		`\n5) Borrar ${emptyLeaves.length} categorías sin productos ni hijos: ${emptyLeaves.map((c) => c.name).join(", ") || "(ninguna)"}`,
	);
	if (APPLY && emptyLeaves.length > 0) {
		for (const leaf of emptyLeaves) {
			await db.delete(categories).where(eq(categories.id, leaf.id));
		}
	}

	// ── 6. Verify the parent rule ─────────────────────────────────────────
	const roots = categoryRows.filter((row) => !row.parentId && !deleted.has(row.name));
	console.log(`\n6) Verificación — ${roots.length} categorías padre (máximo 4):`);
	for (const root of roots) {
		const children = childrenOf.get(root.id) ?? 0;
		const own = productCount.get(root.id) ?? 0;
		console.log(
			`   ${children > 0 ? "✓" : "✗ SIN HIJOS"} ${root.name}: ${children} hijos, ${own} productos propios`,
		);
	}

	if (!APPLY) console.log("\n(dry-run: nada escrito. Agrega --apply y SWEEP_CONFIRM=yes)");
}

await main();
process.exit(0);
