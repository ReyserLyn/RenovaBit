/**
 * CategoryService bulk-delete integration tests.
 *
 * Regression coverage for the silent-unlink bug: `products.categoryId` is
 * ON DELETE SET NULL, so a bulk delete of categories with products must be
 * rejected inside the transaction, exactly like the single-delete path.
 *
 * Strategy: connect to the dev DB, create isolated category/product fixtures
 * with unique names, and clean them up in `afterEach`.
 *
 * Prerequisites:
 *   - Dev Postgres must be running (`docker compose -f docker-compose.dev.yaml up -d`)
 *   - The `DATABASE_URL` env var must point to the dev DB (loaded from packages/db/.env)
 */
import { afterEach, describe, expect, it } from "bun:test";
import { db } from "@renovabit/db";
import { categories, products, users } from "@renovabit/db/schema";
import { eq, inArray } from "drizzle-orm";
import { CategoryService } from "../service";

// ── Helpers ──────────────────────────────────────────────

function uniqueSuffix(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * DB-dependent describes are skipped when no DB is available (e.g. CI sandbox
 * without Postgres). Probing the real connection (not just `DATABASE_URL`
 * presence) is required because Bun auto-loads `.env`, so the env var is set
 * even in sandboxes that have no actual Postgres.
 */
let dbAvailable = false;
try {
	await Promise.race([
		db.select({ id: users.id }).from(users).limit(1),
		new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error("DB probe timeout")), 1500),
		),
	]);
	dbAvailable = true;
} catch {
	dbAvailable = false;
}

const describeDb = dbAvailable ? describe : describe.skip;

// ── Fixtures ─────────────────────────────────────────────

const createdCategoryIds: string[] = [];
const createdProductIds: string[] = [];

async function createCategory(label: string): Promise<string> {
	const suffix = uniqueSuffix();
	const [row] = await db
		.insert(categories)
		.values({
			name: `Test Category ${label} ${suffix}`,
			slug: `test-category-${label}-${suffix}`,
		})
		.returning({ id: categories.id });
	createdCategoryIds.push(row!.id);
	return row!.id;
}

async function createProduct(categoryId: string): Promise<string> {
	const suffix = uniqueSuffix();
	const [row] = await db
		.insert(products)
		.values({
			name: `Test Product ${suffix}`,
			slug: `test-product-${suffix}`,
			sku: `TEST-SKU-${suffix}`,
			price: "10.00",
			categoryId,
		})
		.returning({ id: products.id });
	createdProductIds.push(row!.id);
	return row!.id;
}

afterEach(async () => {
	if (createdProductIds.length > 0) {
		await db.delete(products).where(inArray(products.id, createdProductIds));
		createdProductIds.length = 0;
	}
	if (createdCategoryIds.length > 0) {
		await db.delete(categories).where(inArray(categories.id, createdCategoryIds));
		createdCategoryIds.length = 0;
	}
});

// ── DB-dependent tests ───────────────────────────────────

describeDb("CategoryService.deleteMany (DB)", () => {
	it("rejects the whole batch when a category has products and keeps every link intact", async () => {
		const categoryWithProduct = await createCategory("with-product");
		const emptyCategory = await createCategory("empty");
		const productId = await createProduct(categoryWithProduct);

		await expect(CategoryService.deleteMany([categoryWithProduct, emptyCategory])).rejects.toThrow(
			"No se pueden eliminar categorías con productos",
		);

		// Transaction rolled back: both categories survive.
		const remaining = await db
			.select({ id: categories.id })
			.from(categories)
			.where(inArray(categories.id, [categoryWithProduct, emptyCategory]));
		expect(remaining.map((row) => row.id).sort()).toEqual(
			[categoryWithProduct, emptyCategory].sort(),
		);

		// No product was silently unlinked.
		const [product] = await db
			.select({ categoryId: products.categoryId })
			.from(products)
			.where(eq(products.id, productId));
		expect(product?.categoryId).toBe(categoryWithProduct);
	});

	it("bulk deletes categories without products", async () => {
		const firstCategory = await createCategory("empty");
		const secondCategory = await createCategory("empty-2");

		const result = await CategoryService.deleteMany([firstCategory, secondCategory]);

		expect(result.deletedIds.sort()).toEqual([firstCategory, secondCategory].sort());
		expect(result.deletedCount).toBe(2);
		expect(result.notFoundIds).toEqual([]);

		const remaining = await db
			.select({ id: categories.id })
			.from(categories)
			.where(inArray(categories.id, [firstCategory, secondCategory]));
		expect(remaining).toEqual([]);
	});
});
