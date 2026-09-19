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
import { addReviewReason, REVIEW_REASONS } from "@/utils/review-reasons";
import type { PublicCategoryTree } from "../model";
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

interface CategoryOptions {
	parentId?: string;
	isFeatured?: boolean;
}

async function createCategory(label: string, options: CategoryOptions = {}): Promise<string> {
	const suffix = uniqueSuffix();
	const [row] = await db
		.insert(categories)
		.values({
			name: `Test Category ${label} ${suffix}`,
			slug: `test-category-${label}-${suffix}`,
			parentId: options.parentId ?? null,
			isFeatured: options.isFeatured ?? false,
		})
		.returning({ id: categories.id });
	createdCategoryIds.push(row!.id);
	return row!.id;
}

interface ProductOptions {
	stock?: number;
	needsReview?: boolean;
	/** Semicolon-joined reason list, built with the review-reason helpers. */
	reviewReason?: string | null;
}

async function createProduct(categoryId: string, options: ProductOptions = {}): Promise<string> {
	const suffix = uniqueSuffix();
	const [row] = await db
		.insert(products)
		.values({
			name: `Test Product ${suffix}`,
			slug: `test-product-${suffix}`,
			sku: `TEST-SKU-${suffix}`,
			price: "10.00",
			categoryId,
			stock: options.stock ?? 0,
			needsReview: options.needsReview ?? false,
			reviewReason: options.reviewReason ?? null,
		})
		.returning({ id: products.id });
	createdProductIds.push(row!.id);
	return row!.id;
}

/** Depth-first search over the public tree by category id. */
function findNode(nodes: PublicCategoryTree[], id: string): PublicCategoryTree | null {
	for (const node of nodes) {
		if (node.id === id) return node;
		const found = findNode(node.children, id);
		if (found) return found;
	}
	return null;
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

describeDb("CategoryService public visibility (DB)", () => {
	it("hides a category whose only products have stock 0 from the public tree", async () => {
		const categoryId = await createCategory("zero-stock");
		await createProduct(categoryId, { stock: 0 });

		const tree = await CategoryService.getTreePublic();
		expect(findNode(tree, categoryId)).toBeNull();
	});

	it("shows a category once a visible product has stock", async () => {
		const categoryId = await createCategory("with-stock");
		await createProduct(categoryId, { stock: 3 });

		const tree = await CategoryService.getTreePublic();
		const node = findNode(tree, categoryId);
		expect(node?.productCount).toBe(1);
	});

	it("keeps a parent whose only visible products live in a child (merged counts)", async () => {
		const parentId = await createCategory("parent");
		const childId = await createCategory("child", { parentId });
		await createProduct(childId, { stock: 1 });

		const tree = await CategoryService.getTreePublic();
		expect(findNode(tree, parentId)?.productCount).toBe(1);
		expect(findNode(tree, childId)?.productCount).toBe(1);
	});

	it("hides a category whose product carries a blocking review reason", async () => {
		const categoryId = await createCategory("needs-review");
		await createProduct(categoryId, {
			stock: 5,
			needsReview: true,
			reviewReason: REVIEW_REASONS.aiUnsure,
		});

		const tree = await CategoryService.getTreePublic();
		expect(findNode(tree, categoryId)).toBeNull();
	});

	it("counts an advisory-only product (Sin imagen) toward its category", async () => {
		const categoryId = await createCategory("advisory-reason");
		await createProduct(categoryId, {
			stock: 5,
			needsReview: true,
			reviewReason: addReviewReason(null, REVIEW_REASONS.missingImage),
		});

		const tree = await CategoryService.getTreePublic();
		expect(findNode(tree, categoryId)?.productCount).toBe(1);

		// The public detail total follows the same rule as the tree.
		const [category] = await db
			.select({ slug: categories.slug })
			.from(categories)
			.where(eq(categories.id, categoryId))
			.limit(1);
		const detail = await CategoryService.getBySlugPublic(category!.slug);
		expect(detail?.productCount).toBe(1);
	});

	it("hides a category when an advisory reason coexists with a blocking one", async () => {
		const categoryId = await createCategory("advisory-blocking");
		await createProduct(categoryId, {
			stock: 5,
			needsReview: true,
			reviewReason: addReviewReason(REVIEW_REASONS.missingImage, REVIEW_REASONS.missingBrand),
		});

		const tree = await CategoryService.getTreePublic();
		expect(findNode(tree, categoryId)).toBeNull();
	});

	it("drops the whole subtree when no node has a visible product", async () => {
		const parentId = await createCategory("empty-parent");
		const childId = await createCategory("empty-child", { parentId });
		await createProduct(childId, { stock: 0 });

		const tree = await CategoryService.getTreePublic();
		expect(findNode(tree, parentId)).toBeNull();
		expect(findNode(tree, childId)).toBeNull();
	});

	it("featured categories exclude empty ones and count their subtree", async () => {
		const parentId = await createCategory("featured-parent", { isFeatured: true });
		const childId = await createCategory("featured-child", { parentId });
		await createProduct(childId, { stock: 2 });

		const emptyFeaturedId = await createCategory("featured-empty", { isFeatured: true });
		await createProduct(emptyFeaturedId, { stock: 0 });

		const featured = await CategoryService.getFeaturedPublic(500);
		expect(featured.find((category) => category.id === parentId)?.productCount).toBe(1);
		expect(featured.find((category) => category.id === emptyFeaturedId)).toBeUndefined();
	});
});
