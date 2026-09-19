/**
 * BrandService public visibility integration tests.
 *
 * The public brand surfaces (navbar, sidebar, filters, home carousel) must
 * only list brands with at least one publicly visible product:
 * `isActive = true AND <review visible> AND (stock - reserved) > 0`, where
 * `<review visible>` admits products whose only review reasons are advisory
 * (see `@/utils/product-visibility`).
 *
 * Strategy: connect to the dev DB, create isolated brand/product fixtures
 * with unique names, and clean them up in `afterEach`.
 *
 * Prerequisites:
 *   - Dev Postgres must be running (`docker compose -f docker-compose.dev.yaml up -d`)
 *   - The `DATABASE_URL` env var must point to the dev DB (loaded from packages/db/.env)
 */
import { afterEach, describe, expect, it } from "bun:test";
import { db } from "@renovabit/db";
import { brands, products, users } from "@renovabit/db/schema";
import { inArray } from "drizzle-orm";
import { addReviewReason, REVIEW_REASONS } from "@/utils/review-reasons";
import { BrandService } from "../service";

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

const createdBrandIds: string[] = [];
const createdProductIds: string[] = [];

interface BrandOptions {
	isFeatured?: boolean;
}

async function createBrand(label: string, options: BrandOptions = {}): Promise<string> {
	const suffix = uniqueSuffix();
	const [row] = await db
		.insert(brands)
		.values({
			name: `Test Brand ${label} ${suffix}`,
			slug: `test-brand-${label}-${suffix}`,
			isFeatured: options.isFeatured ?? false,
		})
		.returning({ id: brands.id });
	createdBrandIds.push(row!.id);
	return row!.id;
}

interface ProductOptions {
	stock?: number;
	needsReview?: boolean;
	/** Semicolon-joined reason list, built with the review-reason helpers. */
	reviewReason?: string | null;
}

async function createProduct(brandId: string, options: ProductOptions = {}): Promise<string> {
	const suffix = uniqueSuffix();
	const [row] = await db
		.insert(products)
		.values({
			name: `Test Product ${suffix}`,
			slug: `test-product-${suffix}`,
			sku: `TEST-SKU-${suffix}`,
			price: "10.00",
			brandId,
			stock: options.stock ?? 0,
			needsReview: options.needsReview ?? false,
			reviewReason: options.reviewReason ?? null,
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
	if (createdBrandIds.length > 0) {
		await db.delete(brands).where(inArray(brands.id, createdBrandIds));
		createdBrandIds.length = 0;
	}
});

// ── DB-dependent tests ───────────────────────────────────

describeDb("BrandService public visibility (DB)", () => {
	it("hides a brand whose only products have stock 0 from the unfiltered list", async () => {
		const brandId = await createBrand("zero-stock");
		await createProduct(brandId, { stock: 0 });

		const list = await BrandService.listPublic();
		expect(list.find((brand) => brand.id === brandId)).toBeUndefined();
	});

	it("lists a brand once a visible product exists", async () => {
		const brandId = await createBrand("with-stock");
		await createProduct(brandId, { stock: 3 });

		const list = await BrandService.listPublic();
		const item = list.find((brand) => brand.id === brandId);
		expect(item?.productCount).toBe(1);
	});

	it("hides a brand whose only product carries a blocking review reason", async () => {
		const brandId = await createBrand("needs-review");
		await createProduct(brandId, {
			stock: 5,
			needsReview: true,
			reviewReason: REVIEW_REASONS.aiUnsure,
		});

		const list = await BrandService.listPublic();
		expect(list.find((brand) => brand.id === brandId)).toBeUndefined();
	});

	it("counts a brand whose only product has an advisory reason (Sin imagen)", async () => {
		const brandId = await createBrand("advisory-reason");
		await createProduct(brandId, {
			stock: 5,
			needsReview: true,
			reviewReason: addReviewReason(null, REVIEW_REASONS.missingImage),
		});

		const list = await BrandService.listPublic();
		expect(list.find((brand) => brand.id === brandId)?.productCount).toBe(1);
	});

	it("hides a brand when an advisory reason coexists with a blocking one", async () => {
		const brandId = await createBrand("advisory-blocking");
		await createProduct(brandId, {
			stock: 5,
			needsReview: true,
			reviewReason: addReviewReason(REVIEW_REASONS.missingImage, REVIEW_REASONS.missingBrand),
		});

		const list = await BrandService.listPublic();
		expect(list.find((brand) => brand.id === brandId)).toBeUndefined();
	});

	it("excludes empty brands from featured and keeps brands with visible products", async () => {
		const emptyBrandId = await createBrand("featured-empty", { isFeatured: true });
		await createProduct(emptyBrandId, { stock: 0 });

		const visibleBrandId = await createBrand("featured-visible", { isFeatured: true });
		await createProduct(visibleBrandId, { stock: 2 });

		const featured = await BrandService.getFeaturedPublic(500);
		expect(featured.find((brand) => brand.id === emptyBrandId)).toBeUndefined();
		expect(featured.find((brand) => brand.id === visibleBrandId)?.productCount).toBe(1);
	});
});
