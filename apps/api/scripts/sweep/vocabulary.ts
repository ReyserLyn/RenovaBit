/**
 * Vocabulary sanitization (sweep phase 1).
 *
 * Fixes the taxonomy damage found auditing production: 34 products sitting on
 * parent categories (the code blocklist never matched the real names — accents
 * and the "CPU" suffix broke it) and ~20 more dumped into "Cámaras" because the
 * old prompt named it as a valid option.
 *
 * Creates the missing leaf categories, renames the ambiguous one, moves the
 * misclassified products and repairs the brand duplicates. Every change is
 * audited in `product_changes`. Dry-run by default; writing needs --apply plus
 * SWEEP_CONFIRM=yes.
 *
 * Usage (from apps/api, with DATABASE_URL pointing at the target):
 *   bun run scripts/sweep/vocabulary.ts            # dry-run
 *   SWEEP_CONFIRM=yes bun run scripts/sweep/vocabulary.ts --apply
 */

import { db } from "@renovabit/db";
import {
	brands,
	categories,
	productChanges,
	productProviders,
	products,
} from "@renovabit/db/schema";
import { eq, inArray, isNull } from "drizzle-orm";
import { makeSlug } from "@/utils/db-helpers";

const APPLY = process.argv.includes("--apply");
if (APPLY && process.env.SWEEP_CONFIRM !== "yes") {
	console.error("Falta SWEEP_CONFIRM=yes para escribir en la base de datos.");
	process.exit(1);
}
const BATCH = `sweep-${new Date().toISOString().slice(0, 10)}`;

/** Leaves the catalog needs but never had, with their place in the tree. */
const NEW_CATEGORIES: Array<{ name: string; parent: string | null }> = [
	{ name: "Kits Gamer", parent: "Periféricos" },
	{ name: "Gamepads", parent: "Periféricos" },
	{ name: "Mouse Pads", parent: "Periféricos" },
	{ name: "Routers", parent: "Periféricos" },
	{ name: "Antenas", parent: "Periféricos" },
	{ name: "Tarjetas de Sonido", parent: "Componentes CPU" },
	{ name: "Memorias USB", parent: "Componentes CPU" },
	{ name: "Tarjetas de Red", parent: "Componentes CPU" },
	{ name: "Casa Inteligente", parent: null },
	{ name: "Focos Smart", parent: "Casa Inteligente" },
	{ name: "Antivirus", parent: null },
];

/** "Cámaras" became a dumping ground; it keeps only the security cameras. */
const RENAMES: Array<{ from: string; to: string }> = [
	{ from: "Cámaras", to: "Cámaras de Seguridad" },
];

/** Categories whose products get reclassified (the rest of the catalog is fine).
 * The rename target is included so a re-run after the rename still finds the
 * products that stayed behind. */
const SOURCE_CATEGORIES = ["Periféricos", "Componentes CPU", "Cámaras", "Cámaras de Seguridad"];

/** Ordered rules: first match wins. Mirrors the analysis run over production. */
const CLASSIFICATION_RULES: Array<[RegExp, string]> = [
	[/KIT|COMBO/i, "Kits Gamer"],
	[/ROUTER/i, "Routers"],
	[/MOUSE ?PAD|PAD MOUSE/i, "Mouse Pads"],
	[/MEMORIA USB|USB OTG/i, "Memorias USB"],
	[/TARJETA DE SONIDO/i, "Tarjetas de Sonido"],
	[/TARJETA DE RED/i, "Tarjetas de Red"],
	[/GAME ?PAD/i, "Gamepads"],
	[/HOME SMART|FOCOS|BULB|TIRA DE LUZ|SMART LED|SMART SW/i, "Focos Smart"],
	[/SEGURIDAD|EZVIZ/i, "Cámaras de Seguridad"],
	[/WEB ?CAM/i, "Cámaras Web"],
	[/ANTIVIRUS|KASPERSKY/i, "Antivirus"],
	[/ANTENA/i, "Antenas"],
	[/AUDIFONO|AURICULAR/i, "Audífonos"],
	[/TECLADO|TECLAOD/i, "Teclados"],
	[/MOUSE/i, "Mouses"],
	[/PARLANTE/i, "Parlantes"],
	[/CABLE/i, "Cables"],
	[/CARGADOR/i, "Cargadores"],
	[/MONITOR/i, "Monitores"],
	[/MICROFONO|MICRÓFONO/i, "Micrófonos"],
	[/ESTABILIZADOR/i, "Estabilizadores"],
	[/IMPRESORA/i, "Impresoras"],
	[/MOCHILA/i, "Mochilas"],
	[/SWITCH/i, "Switches"],
	[/PROYECTOR/i, "Proyectores"],
	[/HUB|ADAPTADOR|CONTROLADOR/i, "Adaptadores"],
];

/** Brand duplicates to fold into one canonical row. */
const BRAND_MERGES: Array<{ from: string; into: string }> = [
	{ from: "Deep Cool", into: "Deepcool" },
];

/** Supplier generics with no brand in the feed: they get a house brand so the
 * store stops hiding them behind the "Sin marca" review reason. */
const GENERIC_BRAND = "Genérico";

function classify(raw: string): string | null {
	for (const [pattern, target] of CLASSIFICATION_RULES) {
		if (pattern.test(raw)) return target;
	}
	return null;
}

function slugOf(name: string): string {
	return makeSlug(name);
}

async function main() {
	console.log(`[sweep/vocabulary] ${APPLY ? "APLICANDO" : "DRY-RUN"} (${BATCH})\n`);

	const existing = await db
		.select({
			id: categories.id,
			name: categories.name,
			parentId: categories.parentId,
			path: categories.path,
		})
		.from(categories);
	const byName = new Map(existing.map((row) => [row.name, row]));
	const bySlug = new Map(existing.map((row) => [slugOf(row.name), row]));

	// ── 1. Create the missing leaves ───────────────────────────────────────
	const toCreate = NEW_CATEGORIES.filter((target) => !bySlug.has(slugOf(target.name)));
	console.log(`1) Crear ${toCreate.length} categorías:`);
	for (const target of toCreate) {
		const parent = target.parent ? byName.get(target.parent) : null;
		console.log(`   + ${target.parent ? `${target.parent} > ` : ""}${target.name}`);
		if (APPLY) {
			const [created] = await db
				.insert(categories)
				.values({
					name: target.name,
					slug: slugOf(target.name),
					parentId: parent?.id ?? null,
					// `path` is a materialized ancestor chain used by the descendant
					// filter and the storefront breadcrumb: a direct insert must keep
					// it or the category renders with the wrong depth and no ancestors.
					path: parent ? `${parent.path ?? "/"}${parent.id}/` : "/",
					isActive: true,
				})
				.returning({ id: categories.id, name: categories.name });
			if (created) byName.set(created.name, created);
		}
	}

	// ── 2. Rename the ambiguous category ───────────────────────────────────
	console.log("\n2) Renombrar categorías ambiguas:");
	for (const rename of RENAMES) {
		const row = byName.get(rename.from);
		if (!row) {
			console.log(`   (no existe "${rename.from}", se omite)`);
			continue;
		}
		console.log(`   ~ "${rename.from}" → "${rename.to}"`);
		if (APPLY) {
			await db
				.update(categories)
				.set({ name: rename.to, slug: slugOf(rename.to) })
				.where(eq(categories.id, row.id));
			byName.delete(rename.from);
			byName.set(rename.to, { ...row, name: rename.to });
		}
	}

	// ── 3. Reclassify the misclassified products ───────────────────────────
	const sourceIds = SOURCE_CATEGORIES.map((name) => byName.get(name)?.id).filter(
		(id): id is string => Boolean(id),
	);
	const misplaced = await db
		.select({
			productId: products.id,
			name: products.name,
			rawName: productProviders.rawName,
			categoryName: categories.name,
		})
		.from(products)
		.innerJoin(categories, eq(categories.id, products.categoryId))
		.innerJoin(productProviders, eq(productProviders.productId, products.id))
		.where(inArray(products.categoryId, sourceIds));

	const moves: Array<{ productId: string; from: string; to: string; name: string }> = [];
	const unresolved: string[] = [];

	const plannedNames = new Set([
		...NEW_CATEGORIES.map((target) => target.name),
		...RENAMES.map((rename) => rename.to),
	]);
	for (const product of misplaced) {
		const target = classify(product.rawName ?? "");
		// Products already in the right place stay put (e.g. a real webcam in Cámaras Web).
		if (!target || target === product.categoryName) continue;
		if (!byName.has(target) && !plannedNames.has(target)) {
			unresolved.push(`${product.rawName} → "${target}" (categoría inexistente)`);
			continue;
		}
		moves.push({
			productId: product.productId,
			from: product.categoryName,
			to: target,
			name: product.name,
		});
	}

	console.log(`\n3) Reclasificar ${moves.length} productos:`);
	const byTarget = new Map<string, number>();
	for (const move of moves) byTarget.set(move.to, (byTarget.get(move.to) ?? 0) + 1);
	for (const [target, count] of [...byTarget.entries()].sort((a, b) => b[1] - a[1])) {
		console.log(`   ${target}: ${count}`);
	}
	if (unresolved.length > 0) {
		console.log(`   SIN RESOLVER (${unresolved.length}):`);
		for (const item of unresolved) console.log(`     - ${item}`);
	}

	if (APPLY) {
		for (const move of moves) {
			const target = byName.get(move.to);
			if (!target) continue;
			await db.transaction(async (tx) => {
				await tx
					.update(products)
					.set({ categoryId: target.id })
					.where(eq(products.id, move.productId));
				await tx.insert(productChanges).values({
					productId: move.productId,
					source: "system",
					changeType: "category_changed",
					field: "categoria",
					oldValue: { category: move.from },
					newValue: { category: move.to },
					reason: `Sanitización de taxonomía (${BATCH})`,
				});
			});
		}
		console.log("   → movidos");
	}

	// ── 4. Brands ─────────────────────────────────────────────────────────
	console.log("\n4) Marcas:");
	const allBrands = await db.select({ id: brands.id, name: brands.name }).from(brands);
	const brandByName = new Map(allBrands.map((brand) => [brand.name, brand]));
	const brandBySlug = new Map(allBrands.map((brand) => [slugOf(brand.name), brand]));
	/** Brands are matched by name first and by slug after: "ASUS" and "Asus"
	 * are the same brand, and inserting a duplicate would violate the slug. */
	const findBrand = (name: string) => brandByName.get(name) ?? brandBySlug.get(slugOf(name));

	for (const merge of BRAND_MERGES) {
		const from = findBrand(merge.from);
		const into = findBrand(merge.into);
		if (!from || !into) {
			console.log(`   (merge ${merge.from} → ${merge.into}: falta una de las dos, se omite)`);
			continue;
		}
		const affected = await db
			.select({ id: products.id })
			.from(products)
			.where(eq(products.brandId, from.id));
		console.log(`   ~ ${merge.from} → ${merge.into}: ${affected.length} productos`);
		if (APPLY) {
			await db.transaction(async (tx) => {
				await tx.update(products).set({ brandId: into.id }).where(eq(products.brandId, from.id));
				await tx.update(brands).set({ isActive: false }).where(eq(brands.id, from.id));
			});
		}
	}

	const brandless = await db
		.select({ id: products.id, name: products.name })
		.from(products)
		.where(isNull(products.brandId));
	let generic = findBrand(GENERIC_BRAND);
	console.log(`   + marca "${GENERIC_BRAND}" para ${brandless.length} productos sin marca`);
	if (APPLY && brandless.length > 0) {
		if (!generic) {
			const [created] = await db
				.insert(brands)
				.values({ name: GENERIC_BRAND, slug: slugOf(GENERIC_BRAND), isActive: true })
				.returning({ id: brands.id, name: brands.name });
			generic = created;
		}
		if (generic) {
			const ids = brandless.map((product) => product.id);
			await db.transaction(async (tx) => {
				await tx.update(products).set({ brandId: generic.id }).where(inArray(products.id, ids));
				for (const product of brandless) {
					await tx.insert(productChanges).values({
						productId: product.id,
						source: "system",
						changeType: "brand_changed",
						field: "marca",
						oldValue: { brandId: null },
						newValue: { brand: GENERIC_BRAND },
						reason: `Sanitización de marcas (${BATCH})`,
					});
				}
			});
		}
	}

	// ── 4b. Hand-decided brand remaps ──────────────────────────────────────
	// "AS" was ASUS (the pad is a TUF Miku edition); "CM" is a generic cooler
	// kit, not Cooler Master, so it goes to the house brand.
	const BRAND_REMAPS: Array<{ from: string; to: string }> = [
		{ from: "AS", to: "ASUS" },
		{ from: "CM", to: GENERIC_BRAND },
	];

	console.log("4b) Correcciones de marca puntuales:");
	for (const remap of BRAND_REMAPS) {
		const from = brandByName.get(remap.from);
		if (!from) {
			console.log(`   (no existe "${remap.from}", se omite)`);
			continue;
		}
		const target =
			findBrand(remap.to) ??
			(APPLY
				? (
						await db
							.insert(brands)
							.values({ name: remap.to, slug: slugOf(remap.to), isActive: true })
							.returning({ id: brands.id, name: brands.name })
					)[0]
				: undefined);

		const affected = await db
			.select({ id: products.id })
			.from(products)
			.where(eq(products.brandId, from.id));
		console.log(`   ~ ${remap.from} → ${remap.to}: ${affected.length} productos`);

		if (APPLY && target) {
			await db.transaction(async (tx) => {
				await tx.update(products).set({ brandId: target.id }).where(eq(products.brandId, from.id));
				await tx.update(brands).set({ isActive: false }).where(eq(brands.id, from.id));
			});
			byName.set(target.name, target);
			brandByName.set(target.name, target);
		}
	}

	// ── 4c. Drop review reasons that no longer apply ───────────────────────
	// Products hidden behind "Sin marca" while they now have one (Genérico or a
	// real brand) must come back to the storefront. Reasons that still need a
	// human (IA no confia, Posible duplicado, Precio inválido) are kept.
	const pendingReview = await db
		.select({
			id: products.id,
			reviewReason: products.reviewReason,
			brandId: products.brandId,
			categoryId: products.categoryId,
		})
		.from(products)
		.where(eq(products.needsReview, true));

	let cleaned = 0;
	for (const product of pendingReview) {
		const reasons = (product.reviewReason ?? "")
			.split(";")
			.map((reason) => reason.trim())
			.filter(Boolean);
		const remaining = reasons.filter((reason) => {
			if (reason === "Sin marca") return !product.brandId;
			if (reason === "Sin categoria") return !product.categoryId;
			return true;
		});
		if (remaining.length === reasons.length) continue;
		cleaned++;
		if (APPLY) {
			await db
				.update(products)
				.set({
					needsReview: remaining.length > 0,
					reviewReason: remaining.length > 0 ? remaining.join("; ") : null,
				})
				.where(eq(products.id, product.id));
		}
	}
	console.log(`\n4c) Motivos de revisión obsoletos corregidos: ${cleaned}`);

	// ── 5. Verify: no product may sit on a parent category ─────────────────
	const rows = await db
		.select({ id: categories.id, name: categories.name, parentId: categories.parentId })
		.from(categories);
	const parentIds = new Set(rows.map((row) => row.parentId).filter(Boolean));
	const onParents = await db
		.select({ name: products.name, category: categories.name })
		.from(products)
		.innerJoin(categories, eq(categories.id, products.categoryId))
		.where(
			inArray(
				products.categoryId,
				[...parentIds].filter((id): id is string => Boolean(id)),
			),
		)
		.limit(10);

	console.log(
		`\n5) Verificación${APPLY ? "" : " (estado actual, sin aplicar)"}: productos en categorías padre = ${onParents.length}`,
	);
	for (const row of onParents) console.log(`   ⚠ ${row.category}: ${row.name}`);

	if (!APPLY) console.log("\n(dry-run: nada escrito. Agrega --apply y SWEEP_CONFIRM=yes)");
}

await main();
process.exit(0);
