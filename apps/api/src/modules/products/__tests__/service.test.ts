/**
 * ProductService public listing/search integration tests.
 *
 * Covers the pagination contract the storefront's infinite query depends on:
 * SQL offset paging when nothing JS-only is requested, and full-set fetch +
 * post-pricing filter/sort/slice when prices are involved. Every assertion
 * here fails on the pre-fix code (post-LIMIT price filtering produced gaps,
 * inflated totals and stale-price ordering).
 *
 * Prerequisites:
 *   - Dev Postgres running (`docker compose -f docker-compose.dev.yaml up -d`)
 *   - `DATABASE_URL` pointing to the dev DB (loaded from packages/db/.env)
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@renovabit/db";
import { brands, offerProducts, offers, products, users } from "@renovabit/db/schema";
import { applyOfferToProduct, getEffectiveSalePrice, type Role } from "@renovabit/pricing";
import { eq, inArray } from "drizzle-orm";
import { getActiveMarginRules } from "@/utils/margin-rules";
import { ProductService } from "../service";

// ── DB probe (same pattern as the favorites/orders suites) ───────────────

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

// ── Fixtures ─────────────────────────────────────────────────────────────

const ROLE: Role = "customer";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
/** FTS token without dashes: the spanish tokenizer treats dashes as separators. */
const FTS_TOKEN = `pgtst${Math.random().toString(36).slice(2, 10)}`;
const NAMES = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"];
/** Distinct supplier prices; the 0% custom margin pins the effective base price. */
const SUPPLIER_PRICES = [100, 200, 300, 400, 500, 900];
/** The offer applies to Charlie (300) only: 50% → effective 150. */
const OFFERED_INDEX = 2;
const OFFER_DISCOUNT = 50;

type ProductFixture = {
	id: string;
	supplierPrice: string;
	roleCustomMargins: (typeof products.$inferSelect)["roleCustomMargins"];
};

let brandId: string;
let offerId: string;
let fixtures: ProductFixture[] = [];
let marginRules: Awaited<ReturnType<typeof getActiveMarginRules>>;

beforeAll(async () => {
	if (!dbAvailable) return;

	marginRules = await getActiveMarginRules();

	const [brand] = await db
		.insert(brands)
		.values({
			name: `Paging Test Brand ${suffix}`,
			slug: `paging-test-brand-${suffix}`,
		})
		.returning({ id: brands.id });
	brandId = brand!.id;

	fixtures = await db
		.insert(products)
		.values(
			SUPPLIER_PRICES.map((price, i) => ({
				name: `${NAMES[i]} ${FTS_TOKEN} ${suffix}`,
				slug: `paging-${NAMES[i]!.toLowerCase()}-${suffix}`,
				// Symbol-only prefix for the search SKU fallback.
				sku: i === SUPPLIER_PRICES.length - 1 ? `!!!FB-${suffix}` : `PAGING-${i}-${suffix}`,
				price: price.toFixed(2),
				supplierPrice: price.toFixed(2),
				roleCustomMargins: { customer: { enabled: true as const, percent: "0" } },
				brandId,
				stock: 50,
			})),
		)
		.returning({
			id: products.id,
			supplierPrice: products.supplierPrice,
			roleCustomMargins: products.roleCustomMargins,
		});

	// Active offer that flips the effective order: Charlie's 50% makes it
	// cheaper than Bravo even though its stored price is higher.
	const [offer] = await db
		.insert(offers)
		.values({
			name: `Paging Test Offer ${suffix}`,
			slug: `paging-test-offer-${suffix}`,
			discountValue: OFFER_DISCOUNT.toFixed(2),
			startsAt: new Date(Date.now() - 60_000),
			endsAt: new Date(Date.now() + 3_600_000),
			isActive: true,
		})
		.returning({ id: offers.id });
	offerId = offer!.id;

	await db.insert(offerProducts).values({ offerId, productId: fixtures[OFFERED_INDEX]!.id });
});

/** Base price from the pricing SSOT — never mirrored from service output. */
function expectedBasePrice(fixture: ProductFixture): number {
	return getEffectiveSalePrice(
		{ supplierPrice: fixture.supplierPrice, roleCustomMargins: fixture.roleCustomMargins },
		ROLE,
		marginRules,
	).salePrice;
}

/** Effective price the buyer pays: only Charlie has an active offer. */
function expectedEffectivePrice(fixture: ProductFixture): number {
	const offerInputs =
		fixture.id === fixtures[OFFERED_INDEX]!.id
			? [{ id: offerId, discountValue: OFFER_DISCOUNT }]
			: [];
	return applyOfferToProduct(expectedBasePrice(fixture), offerInputs, ROLE).discountedPrice;
}

afterAll(async () => {
	if (!dbAvailable) return;
	await db.delete(offerProducts).where(eq(offerProducts.offerId, offerId));
	await db.delete(offers).where(eq(offers.id, offerId));
	await db.delete(products).where(
		inArray(
			products.id,
			fixtures.map((f) => f.id),
		),
	);
	await db.delete(brands).where(eq(brands.id, brandId));
});

// ── Tests ────────────────────────────────────────────────────────────────

describeDb("ProductService public catalog (DB)", () => {
	it("listPublic filters minPrice/maxPrice before pagination with an exact total (regression)", async () => {
		const minPrice = 150;
		const maxPrice = 400;
		// The SQL default order is stored price asc, which is the fixture order.
		const expected = fixtures
			.filter((f) => {
				const price = expectedEffectivePrice(f);
				return price >= minPrice && price <= maxPrice;
			})
			.map((f) => f.id);
		expect(expected.length).toBeGreaterThan(1);
		expect(expected.length).toBeLessThan(fixtures.length); // the filter must actually filter

		const page1 = await ProductService.listPublic({
			brandId,
			role: ROLE,
			offset: 0,
			limit: 2,
			minPrice: String(minPrice),
			maxPrice: String(maxPrice),
		});
		const page2 = await ProductService.listPublic({
			brandId,
			role: ROLE,
			offset: 2,
			limit: 2,
			minPrice: String(minPrice),
			maxPrice: String(maxPrice),
		});

		expect(page1.total).toBe(expected.length);
		expect(page2.total).toBe(expected.length);
		expect(page1.data.map((d) => d.id)).toEqual(expected.slice(0, 2));
		expect(page2.data.map((d) => d.id)).toEqual(expected.slice(2));

		for (const item of [...page1.data, ...page2.data]) {
			const effective = item.offerPrice !== null ? Number(item.offerPrice) : Number(item.price);
			expect(effective).toBeGreaterThanOrEqual(minPrice - 0.001);
			expect(effective).toBeLessThanOrEqual(maxPrice + 0.001);
		}

		const seen = new Set([...page1.data, ...page2.data].map((d) => d.id));
		expect(seen.size).toBe(expected.length);
	});

	it("listPublic filters by the effective (offer-aware) price", async () => {
		// Charlie: base 300 → 50% offer → 150. This window matches it only through
		// the offer price; a base-price filter would return nothing.
		const result = await ProductService.listPublic({
			brandId,
			role: ROLE,
			offset: 0,
			limit: 10,
			minPrice: "140",
			maxPrice: "160",
		});

		expect(result.total).toBe(1);
		expect(result.data[0]?.id).toBe(fixtures[OFFERED_INDEX]!.id);
		expect(result.data[0]?.offerPrice).toBe("150.00");
	});

	it("listPublic sorts price_asc by effective price across pages", async () => {
		const expectedAsc = fixtures
			.map((f) => ({ id: f.id, price: expectedEffectivePrice(f) }))
			.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));

		const pages = await Promise.all([
			ProductService.listPublic({ brandId, role: ROLE, offset: 0, limit: 2, sortBy: "price_asc" }),
			ProductService.listPublic({ brandId, role: ROLE, offset: 2, limit: 2, sortBy: "price_asc" }),
			ProductService.listPublic({ brandId, role: ROLE, offset: 4, limit: 2, sortBy: "price_asc" }),
		]);
		const all = pages.flatMap((p) => p.data);

		expect(all.map((d) => d.id)).toEqual(expectedAsc.map((e) => e.id));

		const prices = all.map((d) => (d.offerPrice !== null ? Number(d.offerPrice) : Number(d.price)));
		for (let i = 1; i < prices.length; i++) {
			expect(prices[i]!).toBeGreaterThanOrEqual(prices[i - 1]!);
		}

		// The offer flips Charlie above Bravo in the effective order even though
		// its stored price is higher — the pre-fix discrepancy.
		const charlieIndex = all.findIndex((d) => d.id === fixtures[OFFERED_INDEX]!.id);
		const bravoIndex = all.findIndex((d) => d.id === fixtures[1]!.id);
		expect(charlieIndex).toBeGreaterThanOrEqual(0);
		expect(charlieIndex).toBeLessThan(bravoIndex);
	});

	it("search applies minPrice/maxPrice with an exact total and hasMore", async () => {
		const minPrice = 150;
		const maxPrice = 400;
		const expected = fixtures
			.filter((f) => {
				const price = expectedEffectivePrice(f);
				return price >= minPrice && price <= maxPrice;
			})
			.map((f) => f.id);
		expect(expected.length).toBeGreaterThan(1);

		// price_asc makes the returned order deterministic (effective price).
		const page1 = await ProductService.search(
			FTS_TOKEN,
			2,
			0,
			undefined,
			String(minPrice),
			String(maxPrice),
			"price_asc",
			ROLE,
		);
		const page2 = await ProductService.search(
			FTS_TOKEN,
			2,
			2,
			undefined,
			String(minPrice),
			String(maxPrice),
			"price_asc",
			ROLE,
		);

		expect(page1.total).toBe(expected.length);
		expect(page2.total).toBe(expected.length);
		expect(page1.hasMore).toBe(true);
		expect(page2.hasMore).toBe(false);

		const collected = [...page1.data, ...page2.data];
		expect(collected.length).toBe(expected.length);
		expect(new Set(collected.map((d) => d.id)).size).toBe(expected.length);
		expect(collected.map((d) => d.id).sort()).toEqual([...expected].sort());

		const prices = collected.map((d) =>
			d.offerPrice !== null ? Number(d.offerPrice) : Number(d.price),
		);
		for (const price of prices) {
			expect(price).toBeGreaterThanOrEqual(minPrice - 0.001);
			expect(price).toBeLessThanOrEqual(maxPrice + 0.001);
		}
		for (let i = 1; i < prices.length; i++) {
			expect(prices[i]!).toBeGreaterThanOrEqual(prices[i - 1]!);
		}
	});

	it("search falls back to a SKU prefix when the query has no FTS tokens", async () => {
		const result = await ProductService.search(
			"!!!",
			20,
			0,
			undefined,
			undefined,
			undefined,
			undefined,
			ROLE,
		);

		expect(result.data.map((d) => d.id)).toContain(fixtures[SUPPLIER_PRICES.length - 1]!.id);
		expect(result.total).toBeGreaterThanOrEqual(1);
	});
});
