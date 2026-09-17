/**
 * FavoritesService integration tests.
 *
 * Covers the pagination contract the storefront's infinite query depends on:
 * SQL offset paging, post-pricing JS paging (price filter / price-name sort),
 * exact totals and hasMore. This is the surface where the "page 2 repeats
 * page 1" bug lived — every assertion here fails on the pre-fix code.
 *
 * Prerequisites:
 *   - Dev Postgres running (`docker compose -f docker-compose.dev.yaml up -d`)
 *   - `DATABASE_URL` pointing to the dev DB (loaded from packages/db/.env)
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@renovabit/db";
import { favoriteItems, favorites, products, users } from "@renovabit/db/schema";
import { getEffectiveSalePrice, type Role } from "@renovabit/pricing";
import { eq, inArray } from "drizzle-orm";
import { getActiveMarginRules } from "@/utils/margin-rules";
import { FavoritesService } from "../service";

// ── DB probe (same pattern as offers/margin-rules suites) ────────────────

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

// Distinct supplier prices so the expected price order is deterministic even
// after role-aware margins (uniform multiplier) are applied.
const SUPPLIER_PRICES = [100, 300, 200, 400, 150, 250];
const NAMES = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"];

type ProductFixture = {
	id: string;
	supplierPrice: string;
	roleCustomMargins: (typeof products.$inferSelect)["roleCustomMargins"];
};

let userId: string;
let favoriteId: string;
let fixtures: ProductFixture[] = [];
let marginRules: Awaited<ReturnType<typeof getActiveMarginRules>>;

/** Oldest → newest insertion order. Default sort is newest first. */
let itemOrder: string[] = [];

beforeAll(async () => {
	if (!dbAvailable) return;

	marginRules = await getActiveMarginRules();

	const [user] = await db
		.insert(users)
		.values({ name: "Favorites Test User", email: `favorites-test-${suffix}@example.com` })
		.returning({ id: users.id });
	userId = user!.id;

	const inserted = await db
		.insert(products)
		.values(
			SUPPLIER_PRICES.map((price, i) => ({
				name: `FavTest ${NAMES[i]} ${suffix}`,
				slug: `favtest-${NAMES[i]!.toLowerCase()}-${suffix}`,
				sku: `FAVTEST-${i}-${suffix}`,
				price: (price * 2).toFixed(2),
				supplierPrice: price.toFixed(2),
				stock: 10,
			})),
		)
		.returning({
			id: products.id,
			supplierPrice: products.supplierPrice,
			roleCustomMargins: products.roleCustomMargins,
		});
	fixtures = inserted;

	const [fav] = await db
		.insert(favorites)
		.values({ userId, itemsCount: fixtures.length, lastActivityAt: new Date() })
		.returning({ id: favorites.id });
	favoriteId = fav!.id;

	// Explicit, increasing createdAt makes the default "newest first" order
	// deterministic regardless of insert timing.
	const base = Date.now() - 60_000;
	await db.insert(favoriteItems).values(
		fixtures.map((fixture, i) => ({
			favoriteId,
			productId: fixture.id,
			createdAt: new Date(base + i * 1000),
		})),
	);

	itemOrder = fixtures.map((f) => f.id);
});

/** Expected price from the pricing SSOT — never mirrored from service output. */
function expectedEffectivePrice(fixture: ProductFixture): number {
	return getEffectiveSalePrice(
		{ supplierPrice: fixture.supplierPrice, roleCustomMargins: fixture.roleCustomMargins },
		ROLE,
		marginRules,
	).salePrice;
}

afterAll(async () => {
	if (!dbAvailable) return;
	await db.delete(favoriteItems).where(eq(favoriteItems.favoriteId, favoriteId));
	await db.delete(favorites).where(eq(favorites.id, favoriteId));
	await db.delete(products).where(inArray(products.id, itemOrder));
	await db.delete(users).where(eq(users.id, userId));
});

// ── Tests ────────────────────────────────────────────────────────────────

describeDb("FavoritesService.getItems (DB)", () => {
	it("follows the offset — page 2 is not page 1 (regression)", async () => {
		const newestFirst = [...itemOrder].reverse();

		const page1 = await FavoritesService.getItems(favoriteId, ROLE, { offset: 0, limit: 2 });
		const page2 = await FavoritesService.getItems(favoriteId, ROLE, { offset: 2, limit: 2 });
		const page3 = await FavoritesService.getItems(favoriteId, ROLE, { offset: 4, limit: 2 });

		expect(page1.data.map((d) => d.productId)).toEqual(newestFirst.slice(0, 2));
		expect(page2.data.map((d) => d.productId)).toEqual(newestFirst.slice(2, 4));
		expect(page3.data.map((d) => d.productId)).toEqual(newestFirst.slice(4, 6));

		const all = [...page1.data, ...page2.data, ...page3.data].map((d) => d.productId);
		expect(new Set(all).size).toBe(6);

		expect(page1.total).toBe(6);
		expect(page1.hasMore).toBe(true);
		expect(page2.hasMore).toBe(true);
		expect(page3.hasMore).toBe(false);
	});

	it("walks every page using the client contract (hasMore ? offset + limit) without duplicates", async () => {
		let offset = 0;
		const seen: string[] = [];
		let total = -1;

		for (let guard = 0; guard < 10; guard++) {
			const page = await FavoritesService.getItems(favoriteId, ROLE, { offset, limit: 4 });
			seen.push(...page.data.map((d) => d.productId));
			total = page.total;
			if (!page.hasMore) break;
			offset = page.offset + page.limit;
		}

		expect(seen.length).toBe(6);
		expect(new Set(seen).size).toBe(6);
		expect(total).toBe(6);
	});

	it("returns an empty page with hasMore=false when offset is past the end", async () => {
		const page = await FavoritesService.getItems(favoriteId, ROLE, { offset: 99, limit: 2 });
		expect(page.data.length).toBe(0);
		expect(page.hasMore).toBe(false);
		expect(page.total).toBe(6);
	});

	it("applies the price filter before pagination with an exact total (JS path)", async () => {
		// Bounds derived from the pricing SSOT, not from service output.
		const sorted = fixtures
			.map((f) => ({ id: f.id, price: expectedEffectivePrice(f) }))
			.sort((a, b) => a.price - b.price);
		const minPrice = sorted[1]!.price;
		const maxPrice = sorted[4]!.price;
		const matching = sorted.filter((s) => s.price >= minPrice && s.price <= maxPrice);
		expect(matching.length).toBeLessThan(6); // the filter must actually filter
		expect(matching.length).toBeGreaterThan(0);

		let offset = 0;
		const collected: string[] = [];
		let total = -1;

		for (let guard = 0; guard < 10; guard++) {
			const page = await FavoritesService.getItems(favoriteId, ROLE, {
				offset,
				limit: 2,
				minPrice: String(minPrice),
				maxPrice: String(maxPrice),
			});
			total = page.total;
			for (const item of page.data) {
				collected.push(item.productId);
				const effective =
					item.offerPrice !== null ? Number(item.offerPrice) : Number(item.basePrice);
				expect(effective).toBeGreaterThanOrEqual(minPrice - 0.001);
				expect(effective).toBeLessThanOrEqual(maxPrice + 0.001);
			}
			if (!page.hasMore) break;
			offset = page.offset + page.limit;
		}

		expect(total).toBe(matching.length);
		expect(collected.length).toBe(matching.length);
		expect(new Set(collected).size).toBe(collected.length);
	});

	it("sorts price_asc globally across pages (not per page)", async () => {
		const all = await FavoritesService.getItems(favoriteId, ROLE, {
			offset: 0,
			limit: 6,
			sortBy: "price_asc",
		});
		expect(all.data.length).toBe(6);

		const prices = all.data.map((d) =>
			d.offerPrice !== null ? Number(d.offerPrice) : Number(d.basePrice),
		);
		for (let i = 1; i < prices.length; i++) {
			expect(prices[i]!).toBeGreaterThanOrEqual(prices[i - 1]!);
		}

		// Paged walk continues the global order: page 2 follows page 1.
		const p1 = await FavoritesService.getItems(favoriteId, ROLE, {
			offset: 0,
			limit: 2,
			sortBy: "price_asc",
		});
		const p2 = await FavoritesService.getItems(favoriteId, ROLE, {
			offset: 2,
			limit: 2,
			sortBy: "price_asc",
		});

		expect(p1.data.map((d) => d.productId)).toEqual(all.data.slice(0, 2).map((d) => d.productId));
		expect(p2.data.map((d) => d.productId)).toEqual(all.data.slice(2, 4).map((d) => d.productId));
		expect(p1.total).toBe(6);
		expect(p1.hasMore).toBe(true);
	});
});
