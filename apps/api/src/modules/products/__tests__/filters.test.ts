/**
 * Storefront catalog filter suite (DB-backed).
 *
 * Exercises `GET /api/v1/products` (listPublic) and
 * `GET /api/v1/products/search` (search) against the local copy of production
 * data. Every assertion is scoped to fixtures (unique brand/category/slug/SKU
 * and a unique FTS token), so ambient catalog rows can never leak into an
 * expectation.
 *
 * Fixture matrix: parent category + child + sibling, three brands, active /
 * expired / inactive offers (effective price != stored price), featured,
 * inactive, advisory-only ("Sin imagen"), blocking ("Sin marca"), zero stock,
 * and stock reserved by a pending order.
 *
 * The two pagination routes under test:
 *   - SQL path: plain LIMIT/OFFSET + COUNT when no price filter/sort is asked.
 *   - JS path: fetch the whole WHERE set, enrich offers/margins, filter/sort by
 *     the effective price, then slice — used when minPrice/maxPrice or
 *     sortBy=price_asc|price_desc is present.
 *
 * Prerequisites: dev Postgres running (`docker compose -f docker-compose.dev.yaml up -d`).
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@renovabit/db";
import {
	brands,
	categories,
	offerProducts,
	offers,
	orderItems,
	orders,
	products,
	users,
} from "@renovabit/db/schema";
import { applyOfferToProduct, getEffectiveSalePrice, type Role } from "@renovabit/pricing";
import { Value } from "@sinclair/typebox/value";
import { inArray } from "drizzle-orm";
import { getActiveMarginRules } from "@/utils/margin-rules";
import { REVIEW_REASONS } from "@/utils/review-reasons";
import { ProductModel } from "../model";
import { ProductService } from "../service";

// ── DB probe (same pattern as the other DB-backed suites) ────────────────

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

// ── Fixture matrix ───────────────────────────────────────────────────────

const ROLE: Role = "customer";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
/** FTS token without dashes: the spanish tokenizer treats dashes as separators. */
const FTS_TOKEN = `filtro${Math.random().toString(36).slice(2, 10)}`;
/** SKU prefix with unusual casing, to prove ilike is case-insensitive. */
const SKU_PREFIX = `FILTX${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const BASE_TIME = Date.now() - 24 * 60 * 60 * 1000;

type BrandKey = "A" | "B" | "C";
type CategoryKey = "root" | "child" | "other" | "stock";
type OfferKey = "active50" | "active10" | "expired90" | "inactive80";
type FixtureKey =
	| "alpha"
	| "bravo"
	| "charlie"
	| "delta"
	| "echo"
	| "foxtrot"
	| "golf"
	| "hotel"
	| "india"
	| "juliet"
	| "kilo"
	| "lima"
	| "zulu"
	| "stockStrict"
	| "stockPartial";

type FixtureDef = {
	key: FixtureKey;
	/** First word of the name; the only part distinct across fixtures. */
	label: string;
	supplier: number;
	brand: BrandKey;
	category: CategoryKey;
	stock: number;
	isActive?: boolean;
	isFeatured?: boolean;
	reviewReason?: string;
	/**
	 * Offer attached to the product. Only `active*` keys apply to the effective
	 * price; `expired90` / `inactive80` are attached to prove they do not.
	 */
	offer?: OfferKey;
	/** Full name override, used to embed LIKE/tsquery special characters. */
	nameOverride?: string;
};

/** Active offers and their discount; expired/inactive ones must never apply. */
const ACTIVE_OFFER_PERCENT: Partial<Record<OfferKey, number>> = {
	active50: 50,
	active10: 10,
};

const FIXTURE_DEFS: readonly FixtureDef[] = [
	{
		key: "alpha",
		label: "Alpha",
		supplier: 10,
		brand: "A",
		category: "root",
		stock: 10,
		offer: "expired90",
	},
	{ key: "bravo", label: "Bravo", supplier: 60, brand: "A", category: "child", stock: 10 },
	{
		key: "charlie",
		label: "Charlie",
		supplier: 100,
		brand: "A",
		category: "child",
		stock: 10,
		isFeatured: true,
	},
	{ key: "delta", label: "Delta", supplier: 500, brand: "B", category: "other", stock: 10 },
	{
		key: "echo",
		label: "Echo",
		supplier: 100,
		brand: "A",
		category: "root",
		stock: 10,
		offer: "active50",
	},
	{
		key: "foxtrot",
		label: "Foxtrot",
		supplier: 200,
		brand: "A",
		category: "child",
		stock: 10,
		offer: "active10",
	},
	{ key: "golf", label: "Golf", supplier: 30, brand: "A", category: "root", stock: 0 },
	{
		key: "hotel",
		label: "Hotel",
		supplier: 20,
		brand: "A",
		category: "root",
		stock: 10,
		isActive: false,
	},
	{
		key: "india",
		label: "India",
		supplier: 25,
		brand: "A",
		category: "child",
		stock: 5,
		reviewReason: REVIEW_REASONS.missingImage,
	},
	{
		key: "juliet",
		label: "Juliet",
		supplier: 26,
		brand: "A",
		category: "root",
		stock: 5,
		reviewReason: REVIEW_REASONS.missingBrand,
	},
	{
		key: "kilo",
		label: "Kilo",
		supplier: 300,
		brand: "A",
		category: "other",
		stock: 10,
		isFeatured: true,
	},
	{
		key: "lima",
		label: "Lima",
		supplier: 60,
		brand: "B",
		category: "other",
		stock: 10,
		offer: "inactive80",
	},
	{
		key: "zulu",
		label: "Zulu",
		supplier: 40,
		brand: "A",
		category: "other",
		stock: 10,
		// Literal `%`, `_` and `'`: proves LIKE wildcards are escaped on the list search.
		nameOverride: `Zulu 100%_O'ferta ${FTS_TOKEN} ${suffix}`,
	},
	{
		key: "stockStrict",
		label: "Stock Strict",
		supplier: 11,
		brand: "C",
		category: "stock",
		stock: 1,
	},
	{
		key: "stockPartial",
		label: "Stock Partial",
		supplier: 12,
		brand: "C",
		category: "stock",
		stock: 3,
	},
];

type FixtureRow = {
	id: string;
	slug: string;
	sku: string;
	name: string;
	createdAt: Date;
	/** Effective (offer-aware) price the customer sees. */
	effective: number;
	brandId: string;
	categoryId: string;
};

const DEF_BY_KEY = new Map<FixtureKey, FixtureDef>(FIXTURE_DEFS.map((def) => [def.key, def]));

function def(key: FixtureKey): FixtureDef {
	const found = DEF_BY_KEY.get(key);
	if (!found) throw new Error(`unknown fixture key: ${key}`);
	return found;
}

let fx: Record<FixtureKey, FixtureRow> = {} as Record<FixtureKey, FixtureRow>;
let brandIds: Record<BrandKey, string> = {} as Record<BrandKey, string>;
let brandSlugs: Record<BrandKey, string> = {} as Record<BrandKey, string>;
let categoryIds: Record<CategoryKey, string> = {} as Record<CategoryKey, string>;
let categorySlugs: Record<CategoryKey, string> = {} as Record<CategoryKey, string>;
let marginRules: Awaited<ReturnType<typeof getActiveMarginRules>>;
const createdOfferIds: string[] = [];
const createdOrderIds: string[] = [];

const productName = (fixture: FixtureDef) =>
	fixture.nameOverride ?? `${fixture.label} ${FTS_TOKEN} ${suffix}`;
const productSlug = (key: FixtureKey) => `filters-${key}-${suffix}`;
const productSku = (index: number) => `${SKU_PREFIX}-${String(index).padStart(2, "0")}-${suffix}`;

/** Stored list price for a fixture: 0% custom margin pins it to the supplier price. */
function expectedBasePrice(fixture: FixtureDef): number {
	return getEffectiveSalePrice(
		{
			supplierPrice: fixture.supplier.toFixed(2),
			roleCustomMargins: { customer: { enabled: true as const, percent: "0" } },
		},
		ROLE,
		marginRules,
	).salePrice;
}

/** Effective price: base price with the best ACTIVE offer applied (if any). */
function expectedEffectivePrice(fixture: FixtureDef): number {
	const percent = fixture.offer ? ACTIVE_OFFER_PERCENT[fixture.offer] : undefined;
	const offerInputs = percent === undefined ? [] : [{ discountValue: percent }];
	return applyOfferToProduct(expectedBasePrice(fixture), offerInputs, ROLE).discountedPrice;
}

function isPubliclyVisible(key: FixtureKey): boolean {
	const fixture = def(key);
	return (
		fixture.isActive !== false &&
		fixture.reviewReason !== REVIEW_REASONS.missingBrand &&
		fixture.stock > 0
	);
}

function publicKeysOf(keys: readonly FixtureKey[]): FixtureKey[] {
	return keys.filter(isPubliclyVisible);
}

const keysByBrand = (brand: BrandKey): FixtureKey[] =>
	FIXTURE_DEFS.filter((fixture) => fixture.brand === brand).map((fixture) => fixture.key);

const keysByCategory = (category: CategoryKey): FixtureKey[] =>
	FIXTURE_DEFS.filter((fixture) => fixture.category === category).map((fixture) => fixture.key);

/** Root scope = the parent category plus its child (descendants). */
const ROOT_SCOPE: FixtureKey[] = [...keysByCategory("root"), ...keysByCategory("child")];

const slugOrder = (keys: readonly FixtureKey[]) => keys.map((key) => fx[key].slug);
const sorted = (values: readonly string[]) => [...values].sort();
const slugsOf = (data: ReadonlyArray<{ slug: string }>) => data.map((item) => item.slug);
const sortedSlugsOf = (data: ReadonlyArray<{ slug: string }>) => sorted(slugsOf(data));

const effectiveOf = (item: { price: string; offerPrice: string | null }) =>
	item.offerPrice !== null ? Number.parseFloat(item.offerPrice) : Number.parseFloat(item.price);

/** Effective-price order with the id tiebreak `listPublic`/`search` use. */
function expectedByEffective(keys: readonly FixtureKey[], direction: "asc" | "desc"): FixtureKey[] {
	return [...keys].sort((a, b) => {
		const diff = fx[a].effective - fx[b].effective;
		if (diff !== 0) return direction === "asc" ? diff : -diff;
		return fx[a].id.localeCompare(fx[b].id);
	});
}

/** Response price fields must never decrease (asc) / increase (desc). */
function expectEffectiveMonotonic(
	data: ReadonlyArray<{ price: string; offerPrice: string | null }>,
	direction: "asc" | "desc",
) {
	const prices = data.map(effectiveOf);
	for (let i = 1; i < prices.length; i++) {
		if (direction === "asc") {
			expect(prices[i]!).toBeGreaterThanOrEqual(prices[i - 1]!);
		} else {
			expect(prices[i]!).toBeLessThanOrEqual(prices[i - 1]!);
		}
	}
}

// ── Fixture setup / teardown ─────────────────────────────────────────────

beforeAll(async () => {
	if (!dbAvailable) return;

	marginRules = await getActiveMarginRules();

	const brandRows = await db
		.insert(brands)
		.values([
			{ name: `Filters Brand A ${suffix}`, slug: `filters-brand-a-${suffix}` },
			{ name: `Filters Brand B ${suffix}`, slug: `filters-brand-b-${suffix}` },
			{ name: `Filters Brand C ${suffix}`, slug: `filters-brand-c-${suffix}` },
		])
		.returning({ id: brands.id, slug: brands.slug });

	const [brandARow, brandBRow, brandCRow] = brandRows;
	if (!brandARow || !brandBRow || !brandCRow) throw new Error("brand fixtures not created");
	brandIds = { A: brandARow.id, B: brandBRow.id, C: brandCRow.id };
	brandSlugs = { A: brandARow.slug, B: brandBRow.slug, C: brandCRow.slug };

	const [root] = await db
		.insert(categories)
		.values({ name: `Filters Root ${suffix}`, slug: `filters-root-${suffix}` })
		.returning({ id: categories.id, slug: categories.slug });
	if (!root) throw new Error("root category fixture not created");

	// Child path mirrors categories/service.ts: `${parent.path ?? "/"}${parent.id}/`.
	const [child] = await db
		.insert(categories)
		.values({
			name: `Filters Child ${suffix}`,
			slug: `filters-child-${suffix}`,
			parentId: root.id,
			path: `/${root.id}/`,
		})
		.returning({ id: categories.id, slug: categories.slug });
	const [other] = await db
		.insert(categories)
		.values({ name: `Filters Other ${suffix}`, slug: `filters-other-${suffix}` })
		.returning({ id: categories.id, slug: categories.slug });
	const [stockCat] = await db
		.insert(categories)
		.values({ name: `Filters Stock ${suffix}`, slug: `filters-stock-${suffix}` })
		.returning({ id: categories.id, slug: categories.slug });
	if (!child || !other || !stockCat) throw new Error("category fixtures not created");

	categoryIds = { root: root.id, child: child.id, other: other.id, stock: stockCat.id };
	categorySlugs = {
		root: root.slug,
		child: child.slug,
		other: other.slug,
		stock: stockCat.slug,
	};

	const productRows = await db
		.insert(products)
		.values(
			FIXTURE_DEFS.map((fixture, index) => ({
				name: productName(fixture),
				slug: productSlug(fixture.key),
				sku: productSku(index),
				// Provider product: the pricing SSOT resolves supplierPrice + 0% override.
				price: fixture.supplier.toFixed(2),
				supplierPrice: fixture.supplier.toFixed(2),
				roleCustomMargins: { customer: { enabled: true as const, percent: "0" } },
				stock: fixture.stock,
				brandId: brandIds[fixture.brand],
				categoryId: categoryIds[fixture.category],
				isActive: fixture.isActive ?? true,
				isFeatured: fixture.isFeatured ?? false,
				...(fixture.reviewReason ? { needsReview: true, reviewReason: fixture.reviewReason } : {}),
				// Distinct createdAt per fixture so `newest` has a defined order.
				createdAt: new Date(BASE_TIME + index * 60_000),
			})),
		)
		.returning({ id: products.id, slug: products.slug });

	fx = Object.fromEntries(
		FIXTURE_DEFS.map((fixture, index) => {
			const row = productRows[index];
			if (!row) throw new Error(`product fixture not created: ${fixture.key}`);
			return [
				fixture.key,
				{
					id: row.id,
					slug: row.slug,
					sku: productSku(index),
					name: productName(fixture),
					createdAt: new Date(BASE_TIME + index * 60_000),
					effective: expectedEffectivePrice(fixture),
					brandId: brandIds[fixture.brand],
					categoryId: categoryIds[fixture.category],
				} satisfies FixtureRow,
			];
		}),
	) as Record<FixtureKey, FixtureRow>;

	const offerStart = Date.now() - 3_600_000;
	const offerEnd = Date.now() + 3_600_000;
	const offerRows = await db
		.insert(offers)
		.values([
			{
				name: `Filters Active 50 ${suffix}`,
				slug: `filters-offer-active-50-${suffix}`,
				discountValue: "50.00",
				startsAt: new Date(offerStart),
				endsAt: new Date(offerEnd),
				isActive: true,
			},
			{
				name: `Filters Active 10 ${suffix}`,
				slug: `filters-offer-active-10-${suffix}`,
				discountValue: "10.00",
				startsAt: new Date(offerStart),
				endsAt: new Date(offerEnd),
				isActive: true,
			},
			{
				// Window already closed: must NOT reach the effective price.
				name: `Filters Expired 90 ${suffix}`,
				slug: `filters-offer-expired-90-${suffix}`,
				discountValue: "90.00",
				startsAt: new Date(offerStart - 86_400_000),
				endsAt: new Date(offerStart - 60_000),
				isActive: true,
			},
			{
				// is_active = false: must NOT reach the effective price.
				name: `Filters Inactive 80 ${suffix}`,
				slug: `filters-offer-inactive-80-${suffix}`,
				discountValue: "80.00",
				startsAt: new Date(offerStart),
				endsAt: new Date(offerEnd),
				isActive: false,
			},
		])
		.returning({ id: offers.id });

	const [active50, active10, expired90, inactive80] = offerRows;
	if (!active50 || !active10 || !expired90 || !inactive80) {
		throw new Error("offer fixtures not created");
	}
	createdOfferIds.push(active50.id, active10.id, expired90.id, inactive80.id);
	const offerIdByKey: Record<OfferKey, string> = {
		active50: active50.id,
		active10: active10.id,
		expired90: expired90.id,
		inactive80: inactive80.id,
	};

	const links = FIXTURE_DEFS.flatMap((fixture) =>
		fixture.offer ? [{ offerId: offerIdByKey[fixture.offer], productId: fx[fixture.key].id }] : [],
	);
	if (links.length > 0) {
		await db.insert(offerProducts).values(links);
	}
});

afterAll(async () => {
	if (!dbAvailable) return;

	// The pending order created by the reserved-stock test (items first, then order).
	if (createdOrderIds.length > 0) {
		await db.delete(orderItems).where(inArray(orderItems.orderId, createdOrderIds));
		await db.delete(orders).where(inArray(orders.id, createdOrderIds));
	}
	if (createdOfferIds.length > 0) {
		await db.delete(offerProducts).where(inArray(offerProducts.offerId, createdOfferIds));
		await db.delete(offers).where(inArray(offers.id, createdOfferIds));
	}
	await db.delete(products).where(
		inArray(
			products.id,
			Object.values(fx).map((row) => row.id),
		),
	);
	await db.delete(categories).where(inArray(categories.id, Object.values(categoryIds)));
	await db.delete(brands).where(inArray(brands.id, Object.values(brandIds)));
});

// ── Tests ────────────────────────────────────────────────────────────────

describeDb("ProductService catalog filters (DB)", () => {
	describe("basics — public visibility", () => {
		it("lists exactly the publicly visible fixtures for a brand", async () => {
			const expected = publicKeysOf(keysByBrand("A"));
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(8);
			expect(sortedSlugsOf(result.data)).toEqual(sorted(slugOrder(expected)));
			expect(result.data).toHaveLength(expected.length);
		});

		it("includes the advisory-only product and hides blocking/inactive/zero-stock ones", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				role: ROLE,
				limit: 100,
			});
			const slugs = slugsOf(result.data);

			// Advisory "Sin imagen" is publicly visible (storefront shows a placeholder).
			expect(slugs).toContain(fx.india.slug);
			// Blocking "Sin marca", inactive, and zero-stock stay out of the listing.
			expect(slugs).not.toContain(fx.juliet.slug);
			expect(slugs).not.toContain(fx.hotel.slug);
			expect(slugs).not.toContain(fx.golf.slug);
			// The zero-stock and inactive fixtures are real products, just not listed.
			expect(fx.golf.id).toBeTruthy();
			expect(fx.hotel.id).toBeTruthy();
		});

		it("ignores expired and inactive offers for the effective price", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				role: ROLE,
				limit: 100,
			});

			// alpha carries an expired 90% offer and lima an inactive 80% offer:
			// neither may discount the price the customer sees.
			const alpha = result.data.find((item) => item.slug === fx.alpha.slug);
			expect(alpha?.offerPrice).toBeNull();
			expect(alpha?.offers).toEqual([]);
			expect(Number.parseFloat(alpha?.price ?? "0")).toBe(10);

			const lima = (
				await ProductService.listPublic({ brandId: brandIds.B, role: ROLE, limit: 100 })
			).data.find((item) => item.slug === fx.lima.slug);
			expect(lima?.offerPrice).toBeNull();
			expect(lima?.offers).toEqual([]);
			expect(Number.parseFloat(lima?.price ?? "0")).toBe(60);
		});
	});

	describe("category filters — single", () => {
		it("categorySlug on the parent includes descendant (child) products", async () => {
			const expected = publicKeysOf(ROOT_SCOPE);
			const result = await ProductService.listPublic({
				categorySlug: categorySlugs.root,
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(6);
			expect(sortedSlugsOf(result.data)).toEqual(sorted(slugOrder(expected)));
			// Explicit: the child's product is included through the parent slug.
			expect(slugsOf(result.data)).toContain(fx.bravo.slug);
			expect(slugsOf(result.data)).toContain(fx.charlie.slug);
			// Sibling branch is not part of the root subtree.
			expect(slugsOf(result.data)).not.toContain(fx.delta.slug);
		});

		it("categorySlug on the child stays scoped to the child", async () => {
			const expected = publicKeysOf(keysByCategory("child"));
			const result = await ProductService.listPublic({
				categorySlug: categorySlugs.child,
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(4);
			expect(sortedSlugsOf(result.data)).toEqual(sorted(slugOrder(expected)));
			expect(slugsOf(result.data)).not.toContain(fx.alpha.slug);
		});

		it("categoryId filters the exact category — descendants are NOT expanded (open question)", async () => {
			// OPEN QUESTION (product decision): `categoryId` is an exact match while
			// `categorySlug`/`categories` expand descendants. The storefront only
			// sends slugs, so this asymmetry is documented as-is, not "fixed" here.
			const result = await ProductService.listPublic({
				categoryId: categoryIds.root,
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(2);
			expect(sortedSlugsOf(result.data)).toEqual(sorted(slugOrder(["alpha", "echo"])));
			expect(slugsOf(result.data)).not.toContain(fx.bravo.slug);
		});

		it("unknown categorySlug returns empty with total 0", async () => {
			const result = await ProductService.listPublic({
				categorySlug: `filters-unknown-${suffix}`,
				role: ROLE,
				limit: 100,
			});

			expect(result.data).toEqual([]);
			expect(result.total).toBe(0);
		});

		it("unknown categoryId returns empty with total 0", async () => {
			const result = await ProductService.listPublic({
				categoryId: "00000000-0000-7000-8000-000000000000",
				role: ROLE,
				limit: 100,
			});

			expect(result.data).toEqual([]);
			expect(result.total).toBe(0);
		});
	});

	describe("category filters — multi-select", () => {
		it("categories unions two sibling branches", async () => {
			const expected = publicKeysOf([...ROOT_SCOPE, ...keysByCategory("other")]);
			const result = await ProductService.listPublic({
				categorySlugs: `${categorySlugs.root},${categorySlugs.other}`,
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(10);
			expect(sortedSlugsOf(result.data)).toEqual(sorted(slugOrder(expected)));
		});

		it("categories with parent+child overlap does not duplicate products", async () => {
			const result = await ProductService.listPublic({
				categorySlugs: `${categorySlugs.root},${categorySlugs.child}`,
				role: ROLE,
				limit: 100,
			});
			const slugs = slugsOf(result.data);

			expect(result.total).toBe(6);
			expect(new Set(slugs).size).toBe(slugs.length);
			expect(sorted(slugs)).toEqual(sorted(slugOrder(publicKeysOf(ROOT_SCOPE))));
		});

		it("categories with an unknown slug mixed with a valid one keeps the valid branch", async () => {
			// Documented behavior: an unknown slug contributes no ids; the union
			// still resolves through the slugs that do exist.
			const result = await ProductService.listPublic({
				categorySlugs: `filters-unknown-${suffix},${categorySlugs.other}`,
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(4);
			expect(sortedSlugsOf(result.data)).toEqual(
				sorted(slugOrder(publicKeysOf(keysByCategory("other")))),
			);
		});

		it("categories with only unknown slugs returns empty", async () => {
			const result = await ProductService.listPublic({
				categorySlugs: `filters-unknown-${suffix}`,
				role: ROLE,
				limit: 100,
			});

			expect(result.data).toEqual([]);
			expect(result.total).toBe(0);
		});

		it("categories trims surrounding whitespace around slugs", async () => {
			const result = await ProductService.listPublic({
				categorySlugs: ` ${categorySlugs.root} , ${categorySlugs.other} `,
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(10);
		});
	});

	describe("brand filters", () => {
		it("brands single slug returns that brand's visible products", async () => {
			const result = await ProductService.listPublic({
				brandSlugs: brandSlugs.A,
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(8);
			expect(sortedSlugsOf(result.data)).toEqual(sorted(slugOrder(publicKeysOf(keysByBrand("A")))));
		});

		it("brands multi unions both brands without duplicates", async () => {
			const expected = publicKeysOf([...keysByBrand("A"), ...keysByBrand("B")]);
			const result = await ProductService.listPublic({
				brandSlugs: `${brandSlugs.A},${brandSlugs.B}`,
				role: ROLE,
				limit: 100,
			});
			const slugs = slugsOf(result.data);

			expect(result.total).toBe(10);
			expect(new Set(slugs).size).toBe(slugs.length);
			expect(sorted(slugs)).toEqual(sorted(slugOrder(expected)));
		});

		it("brands with only an unknown slug returns empty", async () => {
			const result = await ProductService.listPublic({
				brandSlugs: `filters-unknown-brand-${suffix}`,
				role: ROLE,
				limit: 100,
			});

			expect(result.data).toEqual([]);
			expect(result.total).toBe(0);
		});

		it("brands with an unknown slug mixed with a valid one keeps the valid brand", async () => {
			// Documented behavior: only resolvable slugs contribute ids.
			const result = await ProductService.listPublic({
				brandSlugs: `filters-unknown-brand-${suffix},${brandSlugs.B}`,
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(2);
			expect(sortedSlugsOf(result.data)).toEqual(sorted(slugOrder(publicKeysOf(keysByBrand("B")))));
		});

		it("brandId (uuid) works like the brand slug", async () => {
			const byId = await ProductService.listPublic({ brandId: brandIds.A, role: ROLE, limit: 100 });
			const bySlug = await ProductService.listPublic({
				brandSlugs: brandSlugs.A,
				role: ROLE,
				limit: 100,
			});

			expect(sortedSlugsOf(byId.data)).toEqual(sortedSlugsOf(bySlug.data));
			expect(byId.total).toBe(bySlug.total);
		});
	});

	describe("combined filters (AND semantics)", () => {
		it("category × brand × isFeatured combines with AND", async () => {
			const featured = await ProductService.listPublic({
				brandId: brandIds.A,
				categorySlug: categorySlugs.root,
				isFeatured: true,
				role: ROLE,
				limit: 100,
			});
			expect(featured.total).toBe(1);
			expect(slugsOf(featured.data)).toEqual([fx.charlie.slug]);

			const notFeatured = await ProductService.listPublic({
				brandId: brandIds.A,
				categorySlug: categorySlugs.root,
				isFeatured: false,
				role: ROLE,
				limit: 100,
			});
			expect(notFeatured.total).toBe(5);
			expect(slugsOf(notFeatured.data)).not.toContain(fx.charlie.slug);
		});

		it("category × brand × search combines with AND", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				categorySlug: categorySlugs.root,
				search: FTS_TOKEN,
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(6);
			expect(sortedSlugsOf(result.data)).toEqual(sorted(slugOrder(publicKeysOf(ROOT_SCOPE))));
		});

		it("excludeSlug removes exactly that product", async () => {
			const full = await ProductService.listPublic({ brandId: brandIds.A, role: ROLE, limit: 100 });
			const excluded = await ProductService.listPublic({
				brandId: brandIds.A,
				excludeSlug: fx.alpha.slug,
				role: ROLE,
				limit: 100,
			});

			expect(excluded.total).toBe(full.total - 1);
			expect(slugsOf(excluded.data)).not.toContain(fx.alpha.slug);
			const expectedRemaining = publicKeysOf(keysByBrand("A")).filter((key) => key !== "alpha");
			expect(sortedSlugsOf(excluded.data)).toEqual(sorted(slugOrder(expectedRemaining)));
		});

		it("excludeSlug is honored in the JS price path too", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				excludeSlug: fx.echo.slug,
				minPrice: "40",
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(5);
			expect(slugsOf(result.data)).not.toContain(fx.echo.slug);
			expect(slugsOf(result.data)).toContain(fx.zulu.slug);
		});
	});

	describe("search filter on the list endpoint", () => {
		it("matches names case-insensitively and scopes to the brand", async () => {
			const lower = await ProductService.listPublic({
				brandId: brandIds.A,
				search: FTS_TOKEN,
				role: ROLE,
				limit: 100,
			});
			const upper = await ProductService.listPublic({
				brandId: brandIds.A,
				search: FTS_TOKEN.toUpperCase(),
				role: ROLE,
				limit: 100,
			});

			expect(lower.total).toBe(8);
			expect(sortedSlugsOf(upper.data)).toEqual(sortedSlugsOf(lower.data));
		});

		it("matches names without the FTS token", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				search: "Alpha",
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(1);
			expect(slugsOf(result.data)).toEqual([fx.alpha.slug]);
		});

		it("matches SKUs case-insensitively", async () => {
			const lower = await ProductService.listPublic({
				brandId: brandIds.A,
				search: SKU_PREFIX.toLowerCase(),
				role: ROLE,
				limit: 100,
			});
			const upper = await ProductService.listPublic({
				brandId: brandIds.A,
				search: SKU_PREFIX,
				role: ROLE,
				limit: 100,
			});

			expect(lower.total).toBe(8);
			expect(sortedSlugsOf(upper.data)).toEqual(sortedSlugsOf(lower.data));
		});

		it("treats LIKE wildcards as literals (%, _)", async () => {
			// Only zulu carries a literal "%" and "_" in its name; without escaping
			// both patterns would match every fixture and prove nothing.
			const percent = await ProductService.listPublic({
				brandId: brandIds.A,
				search: "%",
				role: ROLE,
				limit: 100,
			});
			const underscore = await ProductService.listPublic({
				brandId: brandIds.A,
				search: "_",
				role: ROLE,
				limit: 100,
			});

			expect(percent.total).toBe(1);
			expect(slugsOf(percent.data)).toEqual([fx.zulu.slug]);
			expect(underscore.total).toBe(1);
			expect(slugsOf(underscore.data)).toEqual([fx.zulu.slug]);
		});

		it("handles an apostrophe without breaking SQL", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				search: "'",
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(1);
			expect(slugsOf(result.data)).toEqual([fx.zulu.slug]);
		});

		it("handles a lone backslash without breaking the LIKE pattern", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				search: "\\",
				role: ROLE,
				limit: 100,
			});

			expect(result.data).toEqual([]);
			expect(result.total).toBe(0);
		});

		it("returns empty when nothing matches", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				search: `no-such-product-${suffix}`,
				role: ROLE,
				limit: 100,
			});

			expect(result.data).toEqual([]);
			expect(result.total).toBe(0);
		});
	});

	describe("stock reservation", () => {
		it("a pending order hides the fully reserved product and reduces reported stock", async () => {
			const before = await ProductService.listPublic({
				brandId: brandIds.C,
				role: ROLE,
				limit: 100,
			});
			expect(before.total).toBe(2);

			const [order] = await db
				.insert(orders)
				.values({
					orderNumber: `filters-reserved-${suffix}`,
					status: "pending",
					subtotal: "23.00",
					total: "23.00",
				})
				.returning({ id: orders.id });
			if (!order) throw new Error("order fixture not created");
			createdOrderIds.push(order.id);

			await db.insert(orderItems).values([
				{
					orderId: order.id,
					productId: fx.stockStrict.id,
					productName: fx.stockStrict.name,
					productSku: fx.stockStrict.sku,
					quantity: 1,
					unitPrice: "11.00",
					finalPrice: "11.00",
				},
				{
					orderId: order.id,
					productId: fx.stockPartial.id,
					productName: fx.stockPartial.name,
					productSku: fx.stockPartial.sku,
					quantity: 1,
					unitPrice: "12.00",
					finalPrice: "12.00",
				},
			]);

			const after = await ProductService.listPublic({
				brandId: brandIds.C,
				role: ROLE,
				limit: 100,
			});

			// stockStrict: 1 - 1 reserved = 0 available → out of the listing.
			expect(after.total).toBe(1);
			expect(slugsOf(after.data)).toEqual([fx.stockPartial.slug]);
			// stockPartial: 3 - 1 reserved = 2 available, still in stock.
			expect(after.data[0]?.stock).toBe(2);
			expect(after.data[0]?.isInStock).toBe(true);

			// Search intentionally does not apply the stock rule: the reserved
			// product is still findable, but reports the reduced availability.
			const searchResult = await ProductService.search(
				FTS_TOKEN,
				100,
				0,
				brandSlugs.C,
				undefined,
				undefined,
				undefined,
				ROLE,
			);
			const strict = searchResult.data.find((item) => item.slug === fx.stockStrict.slug);
			expect(strict).toBeDefined();
			expect(strict?.stock).toBe(0);
			expect(strict?.isInStock).toBe(false);
		});
	});

	describe("price filter — JS pagination path", () => {
		it("minPrice is inclusive and total is the matching count", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				minPrice: "50",
				role: ROLE,
				limit: 100,
			});

			// alpha 10, india 25, zulu 40 stay out; echo 50 is exactly on the bound.
			expect(result.total).toBe(5);
			expect(sortedSlugsOf(result.data)).toEqual(
				sorted(slugOrder(["bravo", "charlie", "echo", "foxtrot", "kilo"])),
			);
			for (const item of result.data) {
				expect(effectiveOf(item)).toBeGreaterThanOrEqual(50 - 0.001);
			}
		});

		it("maxPrice is inclusive", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				maxPrice: "50",
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(4);
			expect(sortedSlugsOf(result.data)).toEqual(
				sorted(slugOrder(["alpha", "echo", "india", "zulu"])),
			);
			for (const item of result.data) {
				expect(effectiveOf(item)).toBeLessThanOrEqual(50 + 0.001);
			}
		});

		it("minPrice+maxPrice window includes both bounds", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				minPrice: "40",
				maxPrice: "100",
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(4);
			const slugs = slugsOf(result.data);
			expect(sorted(slugs)).toEqual(sorted(slugOrder(["bravo", "charlie", "echo", "zulu"])));
			// Bound products are included on both ends (inclusive semantics).
			expect(slugs).toContain(fx.zulu.slug); // 40.00
			expect(slugs).toContain(fx.charlie.slug); // 100.00
		});

		it("minPrice > maxPrice returns empty with total 0", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				minPrice: "100",
				maxPrice: "50",
				role: ROLE,
				limit: 100,
			});

			expect(result.data).toEqual([]);
			expect(result.total).toBe(0);
		});

		it("decimal bounds filter precisely", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				minPrice: "49.99",
				maxPrice: "60.01",
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(2);
			expect(sortedSlugsOf(result.data)).toEqual(sorted(slugOrder(["bravo", "echo"])));
		});

		it("filters on the effective price of an offered product", async () => {
			// echo: base 100 → 50% offer → 50. A base-price filter would match
			// nothing in this window.
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				minPrice: "50",
				maxPrice: "50",
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(1);
			expect(result.data[0]?.slug).toBe(fx.echo.slug);
			expect(result.data[0]?.price).toBe("100.00");
			expect(result.data[0]?.offerPrice).toBe("50.00");
		});

		it("combines category × brand × search × price with AND", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				categorySlug: categorySlugs.root,
				search: FTS_TOKEN,
				minPrice: "40",
				maxPrice: "100",
				role: ROLE,
				limit: 100,
			});

			expect(result.total).toBe(3);
			expect(sortedSlugsOf(result.data)).toEqual(sorted(slugOrder(["bravo", "charlie", "echo"])));
		});

		it("total reflects the filtered set, not the unfiltered brand count", async () => {
			const unfiltered = await ProductService.listPublic({
				brandId: brandIds.A,
				role: ROLE,
				limit: 100,
			});
			const filtered = await ProductService.listPublic({
				brandId: brandIds.A,
				minPrice: "150",
				role: ROLE,
				limit: 100,
			});

			expect(unfiltered.total).toBe(8);
			expect(filtered.total).toBe(2);
			expect(sortedSlugsOf(filtered.data)).toEqual(sorted(slugOrder(["foxtrot", "kilo"])));
		});

		it("pages continuously without duplicates or gaps (limit=2)", async () => {
			const expected = publicKeysOf(keysByBrand("A"));
			const pages = [];
			for (let offset = 0; offset < expected.length; offset += 2) {
				pages.push(
					await ProductService.listPublic({
						brandId: brandIds.A,
						minPrice: "0",
						role: ROLE,
						limit: 2,
						offset,
					}),
				);
			}
			const collected = pages.flatMap((page) => page.data);

			for (const page of pages) {
				expect(page.total).toBe(expected.length);
			}
			expect(collected).toHaveLength(expected.length);
			expect(new Set(collected.map((item) => item.id)).size).toBe(expected.length);
			expect(sortedSlugsOf(collected)).toEqual(sorted(slugOrder(expected)));
			// No sortBy was requested: the default order is effective-price ascending.
			const prices = collected.map(effectiveOf);
			for (let i = 1; i < prices.length; i++) {
				expect(prices[i]!).toBeGreaterThanOrEqual(prices[i - 1]!);
			}
		});
	});

	describe("price sorting — JS pagination path", () => {
		it("price_asc orders by the effective price and flips the stored order", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				sortBy: "price_asc",
				role: ROLE,
				limit: 100,
			});
			const expected = expectedByEffective(publicKeysOf(keysByBrand("A")), "asc");

			expect(slugsOf(result.data)).toEqual(slugOrder(expected));
			expectEffectiveMonotonic(result.data, "asc");

			// echo's stored price (100) is above bravo's (60) but its effective
			// price (50, 50% offer) is below — the effective order must flip them.
			const echoIndex = slugsOf(result.data).indexOf(fx.echo.slug);
			const bravoIndex = slugsOf(result.data).indexOf(fx.bravo.slug);
			expect(echoIndex).toBeGreaterThanOrEqual(0);
			expect(echoIndex).toBeLessThan(bravoIndex);
		});

		it("price_desc orders by the effective price descending", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				sortBy: "price_desc",
				role: ROLE,
				limit: 100,
			});
			const expected = expectedByEffective(publicKeysOf(keysByBrand("A")), "desc");

			expect(slugsOf(result.data)).toEqual(slugOrder(expected));
			expectEffectiveMonotonic(result.data, "desc");
		});

		it("pages price-sorted ties without duplicates or gaps (limit=5)", async () => {
			// bravo (A) and lima (B) both cost 60.00: the tie straddles the page
			// boundary at limit=5 and must stay stable across pages.
			const expected = expectedByEffective(
				publicKeysOf([...keysByBrand("A"), ...keysByBrand("B")]),
				"asc",
			);
			const pages = [];
			for (let offset = 0; offset < expected.length; offset += 5) {
				pages.push(
					await ProductService.listPublic({
						brandSlugs: `${brandSlugs.A},${brandSlugs.B}`,
						sortBy: "price_asc",
						role: ROLE,
						limit: 5,
						offset,
					}),
				);
			}
			const collected = pages.flatMap((page) => page.data);

			for (const page of pages) {
				expect(page.total).toBe(expected.length);
			}
			expect(slugsOf(collected)).toEqual(slugOrder(expected));
			expect(new Set(collected.map((item) => item.id)).size).toBe(expected.length);
		});

		it("combines price sort with price filter and category", async () => {
			const result = await ProductService.listPublic({
				categorySlug: categorySlugs.root,
				minPrice: "40",
				maxPrice: "200",
				sortBy: "price_asc",
				role: ROLE,
				limit: 100,
			});

			// Root scope: alpha 10, bravo 60, charlie 100, echo 50, foxtrot 180,
			// india 25. Window 40..200 → echo, bravo, charlie, foxtrot.
			expect(result.total).toBe(4);
			expect(slugsOf(result.data)).toEqual(
				slugOrder(expectedByEffective(["echo", "bravo", "charlie", "foxtrot"], "asc")),
			);
			expectEffectiveMonotonic(result.data, "asc");
		});
	});

	describe("other sorts", () => {
		it("name_asc / name_desc order by name", async () => {
			const keys = publicKeysOf(keysByBrand("A"));
			const asc = await ProductService.listPublic({
				brandId: brandIds.A,
				sortBy: "name_asc",
				role: ROLE,
				limit: 100,
			});
			const desc = await ProductService.listPublic({
				brandId: brandIds.A,
				sortBy: "name_desc",
				role: ROLE,
				limit: 100,
			});

			const expectedNames = [...keys]
				.map((key) => fx[key].name)
				.sort((a, b) => a.localeCompare(b, "en"));
			expect(asc.data.map((item) => item.name)).toEqual(expectedNames);
			expect(desc.data.map((item) => item.name)).toEqual([...expectedNames].reverse());
			// Sanity: the first letters decide the order (Alpha ... Zulu).
			expect(asc.data[0]?.name).toBe(fx.alpha.name);
			expect(asc.data.at(-1)?.name).toBe(fx.zulu.name);
		});

		it("newest orders by createdAt descending", async () => {
			const keys = publicKeysOf(keysByBrand("A"));
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				sortBy: "newest",
				role: ROLE,
				limit: 100,
			});

			const expected = [...keys].sort(
				(a, b) => fx[b].createdAt.getTime() - fx[a].createdAt.getTime(),
			);
			expect(slugsOf(result.data)).toEqual(slugOrder(expected));
			expect(result.data[0]?.slug).toBe(fx.zulu.slug); // newest fixture
			expect(result.data.at(-1)?.slug).toBe(fx.alpha.slug); // oldest fixture
		});

		it("default order (no sortBy) follows the effective price customers see", async () => {
			// The default is "cheapest first" over the OFFER-AWARE price: an active
			// offer can move a product ahead of cheaper base prices, and the visible
			// sequence stays monotonic in the price the cards show.
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				role: ROLE,
				limit: 100,
			});

			const effective = result.data.map(effectiveOf);
			for (let i = 1; i < effective.length; i++) {
				expect(effective[i]!).toBeGreaterThanOrEqual(effective[i - 1]!);
			}
			// The stored price does not follow the same order (echo: 100 stored / 50 effective).
			const stored = result.data.map((item) => Number.parseFloat(item.price));
			expect(stored).not.toEqual([...stored].sort((a, b) => a - b));
		});

		it("rejects an invalid sortBy at the schema level (400)", () => {
			expect(Value.Check(ProductModel.listQuery, { sortBy: "bogus" })).toBe(false);
			expect(Value.Check(ProductModel.searchQuery, { q: "test", sortBy: "bogus" })).toBe(false);
			for (const sortBy of ["price_asc", "price_desc", "name_asc", "name_desc", "newest"]) {
				expect(Value.Check(ProductModel.listQuery, { sortBy })).toBe(true);
			}
		});
	});

	describe("pagination — default order (JS path)", () => {
		it("pages continuously without duplicates or gaps (limit=2)", async () => {
			const expected = publicKeysOf(keysByBrand("A"));
			const pages = [];
			for (let offset = 0; offset < expected.length; offset += 2) {
				pages.push(
					await ProductService.listPublic({
						brandId: brandIds.A,
						role: ROLE,
						limit: 2,
						offset,
					}),
				);
			}
			const collected = pages.flatMap((page) => page.data);

			for (const page of pages) {
				expect(page.total).toBe(expected.length);
			}
			expect(collected).toHaveLength(expected.length);
			expect(new Set(collected.map((item) => item.id)).size).toBe(expected.length);
			expect(sortedSlugsOf(collected)).toEqual(sorted(slugOrder(expected)));
			const prices = collected.map(effectiveOf);
			for (let i = 1; i < prices.length; i++) {
				expect(prices[i]!).toBeGreaterThanOrEqual(prices[i - 1]!);
			}
		});

		it("SQL path pages continuously with an explicit non-price sort", async () => {
			const expected = publicKeysOf(keysByBrand("A"));
			const page1 = await ProductService.listPublic({
				brandId: brandIds.A,
				sortBy: "name_asc",
				role: ROLE,
				limit: 3,
				offset: 0,
			});
			const page2 = await ProductService.listPublic({
				brandId: brandIds.A,
				sortBy: "name_asc",
				role: ROLE,
				limit: 3,
				offset: 3,
			});

			expect(page1.total).toBe(expected.length);
			const collected = [...page1.data, ...page2.data];
			expect(new Set(collected.map((item) => item.id)).size).toBe(collected.length);
		});

		it("offset beyond the total returns empty data with the real total", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				role: ROLE,
				offset: 1000,
				limit: 20,
			});

			expect(result.data).toEqual([]);
			expect(result.total).toBe(8);
			expect(result.offset).toBe(1000);
		});

		it("limit larger than the result set returns everything", async () => {
			const result = await ProductService.listPublic({
				brandId: brandIds.A,
				role: ROLE,
				limit: 100,
			});

			expect(result.data).toHaveLength(8);
			expect(result.total).toBe(8);
		});

		it("keeps total exact with category + brand + search filters", async () => {
			const page1 = await ProductService.listPublic({
				brandId: brandIds.A,
				categorySlug: categorySlugs.root,
				search: FTS_TOKEN,
				role: ROLE,
				limit: 2,
				offset: 0,
			});
			const page2 = await ProductService.listPublic({
				brandId: brandIds.A,
				categorySlug: categorySlugs.root,
				search: FTS_TOKEN,
				role: ROLE,
				limit: 2,
				offset: 2,
			});
			const page3 = await ProductService.listPublic({
				brandId: brandIds.A,
				categorySlug: categorySlugs.root,
				search: FTS_TOKEN,
				role: ROLE,
				limit: 2,
				offset: 4,
			});

			expect(page1.total).toBe(6);
			expect(page2.total).toBe(6);
			expect(page3.total).toBe(6);
			expect(page1.data).toHaveLength(2);
			expect(page2.data).toHaveLength(2);
			expect(page3.data).toHaveLength(2);

			const collected = [...page1.data, ...page2.data, ...page3.data];
			expect(new Set(collected.map((item) => item.id)).size).toBe(6);
		});

		it("caps/rejects limit at the schema level (1..100)", () => {
			expect(Value.Check(ProductModel.listQuery, { limit: 1 })).toBe(true);
			expect(Value.Check(ProductModel.listQuery, { limit: 100 })).toBe(true);
			expect(Value.Check(ProductModel.listQuery, { limit: 101 })).toBe(false);
			expect(Value.Check(ProductModel.listQuery, { limit: 0 })).toBe(false);
			expect(Value.Check(ProductModel.listQuery, { offset: 10000 })).toBe(true);
			expect(Value.Check(ProductModel.listQuery, { offset: 10001 })).toBe(false);
		});
	});

	describe("search endpoint", () => {
		it("filters by brand slugs and includes zero-stock matches (search never filtered stock)", async () => {
			const result = await ProductService.search(
				FTS_TOKEN,
				100,
				0,
				brandSlugs.A,
				undefined,
				undefined,
				undefined,
				ROLE,
			);
			const slugs = slugsOf(result.data);

			expect(result.total).toBe(9);
			expect(slugs).toContain(fx.golf.slug); // stock 0: findable but not buyable
			expect(slugs).not.toContain(fx.hotel.slug); // inactive
			expect(slugs).not.toContain(fx.juliet.slug); // blocking review reason
			expect(result.data.find((item) => item.slug === fx.golf.slug)?.isInStock).toBe(false);
		});

		it("filters by multiple brand slugs", async () => {
			const result = await ProductService.search(
				FTS_TOKEN,
				100,
				0,
				`${brandSlugs.A},${brandSlugs.B}`,
				undefined,
				undefined,
				undefined,
				ROLE,
			);

			expect(result.total).toBe(11);
			expect(slugsOf(result.data)).toContain(fx.delta.slug);
			expect(slugsOf(result.data)).toContain(fx.lima.slug);
		});

		it("returns empty for an unknown brand slug", async () => {
			const result = await ProductService.search(
				FTS_TOKEN,
				100,
				0,
				`filters-unknown-brand-${suffix}`,
				undefined,
				undefined,
				undefined,
				ROLE,
			);

			expect(result.data).toEqual([]);
			expect(result.total).toBe(0);
			expect(result.hasMore).toBe(false);
		});

		it("filters price on the effective price with an exact total", async () => {
			const result = await ProductService.search(
				FTS_TOKEN,
				100,
				0,
				brandSlugs.A,
				"150",
				undefined,
				undefined,
				ROLE,
			);

			// foxtrot 180 (base 200 - 10%) and kilo 300; the offered product
			// matches through its effective price.
			expect(result.total).toBe(2);
			expect(sortedSlugsOf(result.data)).toEqual(sorted(slugOrder(["foxtrot", "kilo"])));
			for (const item of result.data) {
				expect(effectiveOf(item)).toBeGreaterThanOrEqual(150 - 0.001);
			}
		});

		it("sorts price_asc by effective price and pages with hasMore", async () => {
			const expected = expectedByEffective(publicKeysOf(keysByBrand("A")).concat("golf"), "asc");
			const pages = [];
			for (let offset = 0; offset < expected.length; offset += 2) {
				pages.push(
					await ProductService.search(
						FTS_TOKEN,
						2,
						offset,
						brandSlugs.A,
						"0",
						undefined,
						"price_asc",
						ROLE,
					),
				);
			}
			const collected = pages.flatMap((page) => page.data);

			for (const [index, page] of pages.entries()) {
				expect(page.total).toBe(9);
				const isLastPage = index === pages.length - 1;
				expect(page.hasMore).toBe(!isLastPage);
			}
			expect(slugsOf(collected)).toEqual(slugOrder(expected));
			expect(new Set(collected.map((item) => item.id)).size).toBe(9);
			expectEffectiveMonotonic(collected, "asc");
		});

		it("pages the SQL path with an exact total and hasMore", async () => {
			const expected = publicKeysOf(keysByBrand("A")).concat("golf");
			const pages = [];
			for (let offset = 0; offset < expected.length; offset += 4) {
				pages.push(
					await ProductService.search(
						FTS_TOKEN,
						4,
						offset,
						brandSlugs.A,
						undefined,
						undefined,
						undefined,
						ROLE,
					),
				);
			}
			const collected = pages.flatMap((page) => page.data);

			expect(collected).toHaveLength(9);
			expect(new Set(collected.map((item) => item.id)).size).toBe(9);
			expect(sortedSlugsOf(collected)).toEqual(sorted(slugOrder(expected)));
			expect(pages[0]?.total).toBe(9);
			expect(pages[0]?.hasMore).toBe(true);
			expect(pages.at(-1)?.hasMore).toBe(false);
		});

		it("returns empty instead of throwing on a malformed tsquery (regression: Drizzle wraps the SQLSTATE)", async () => {
			// `'%` builds the tsquery `'%:*` (unterminated quoted lexeme) and
			// Postgres answers SQLSTATE 42601. Drizzle 0.45 wraps driver errors in
			// `DrizzleQueryError`, which drops `.code`, so the service guard used to
			// miss the malformed query and surface a 500. It must return empty.
			const result = await ProductService.search(
				"'%",
				100,
				0,
				brandSlugs.A,
				undefined,
				undefined,
				undefined,
				ROLE,
			);

			expect(result.data).toEqual([]);
			expect(result.total).toBe(0);
			expect(result.hasMore).toBe(false);
		});

		it("does not break on other LIKE/tsquery special characters", async () => {
			for (const query of ["%%", "%_", "!!"]) {
				const result = await ProductService.search(
					query,
					100,
					0,
					brandSlugs.A,
					undefined,
					undefined,
					undefined,
					ROLE,
				);
				expect(Array.isArray(result.data)).toBe(true);
				expect(result.total).toBe(0);
			}
		});

		it("agrees with the list endpoint on overlapping brand+price+sort params", async () => {
			const listResult = await ProductService.listPublic({
				brandSlugs: brandSlugs.A,
				minPrice: "150",
				sortBy: "price_asc",
				role: ROLE,
				limit: 100,
			});
			const searchResult = await ProductService.search(
				FTS_TOKEN,
				100,
				0,
				brandSlugs.A,
				"150",
				undefined,
				"price_asc",
				ROLE,
			);

			expect(slugsOf(listResult.data)).toEqual([fx.foxtrot.slug, fx.kilo.slug]);
			expect(slugsOf(searchResult.data)).toEqual(slugsOf(listResult.data));
			expect(searchResult.total).toBe(listResult.total);
		});
	});
});
