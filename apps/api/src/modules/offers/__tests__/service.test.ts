/**
 * OfferService integration tests.
 *
 * Strategy: connect to the dev DB, use unique slugs/timestamps per test,
 * and clean up test data in `afterEach`. Each test is independent.
 *
 * Prerequisites:
 *   - Dev Postgres must be running (`docker compose -f docker-compose.dev.yaml up -d`)
 *   - The `DATABASE_URL` env var must point to the dev DB (loaded from packages/db/.env)
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@renovabit/db";
import { brands, offerProducts, offers, products, users } from "@renovabit/db/schema";
import { applyOfferToProduct, getEffectiveSalePrice } from "@renovabit/pricing";
import { Value } from "@sinclair/typebox/value";
import { and, eq, inArray } from "drizzle-orm";
import { makeSlug } from "@/utils/db-helpers";
import { getActiveMarginRules } from "@/utils/margin-rules";
import { OfferModel } from "../model";
import { OfferService } from "../service";

// ── Helpers ──────────────────────────────────────────────

/**
 * Generates a unique slug for test isolation.
 */
function uniqueSlug(label = "test"): string {
	return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Unique suffix for fixtures that need several coordinated values. */
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * DB-dependent describes use this so they are skipped when no DB is
 * available (e.g. CI sandbox without Postgres, or local dev without
 * `docker compose -f docker-compose.dev.yaml up -d`). The pure-logic
 * describes above still run.
 *
 * Probing the real connection (not just `DATABASE_URL` presence) is
 * required because Bun auto-loads `.env`, so the env var is set even in
 * sandboxes that have no actual Postgres. The 1.5s timeout avoids hanging
 * the test runner when the host is unreachable.
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

let testUserId: string;
let sampleProductId: string;
let sampleBrandId: string | undefined;
let sampleBrandSlug: string | undefined;

/**
 * Load seed data once before all tests.
 *
 * If no DATABASE_URL is configured the DB-backed describes are skipped via
 * `describeDb` above, so the seed lookup is also skipped to avoid an
 * unhandled connection error in sandboxes.
 */
beforeAll(async () => {
	if (!dbAvailable) return; // DB-backed describes are skipped via describeDb

	// Find a real user
	const [user] = await db.select({ id: users.id }).from(users).limit(1);
	if (!user) {
		throw new Error("No users found in the dev DB. Seed users before running these tests.");
	}
	testUserId = user.id;

	const allProducts = await db
		.select({ id: products.id, brandId: products.brandId })
		.from(products)
		.limit(1);
	if (allProducts.length === 0) {
		throw new Error(
			"No products found in the dev DB. Seed some products before running these tests.",
		);
	}
	sampleProductId = allProducts[0]!.id;
	sampleBrandId = allProducts[0]!.brandId ?? undefined;

	if (sampleBrandId) {
		const [brand] = await db
			.select({ slug: brands.slug })
			.from(brands)
			.where(eq(brands.id, sampleBrandId))
			.limit(1);
		sampleBrandSlug = brand?.slug;
	}
});

// ── Cleanup tracking ─────────────────────────────────────

const createdOfferIds: string[] = [];
const createdProductIds: string[] = [];

async function cleanupOffers() {
	if (createdOfferIds.length > 0) {
		await db.delete(offerProducts).where(inArray(offerProducts.offerId, createdOfferIds));
		await db.delete(offers).where(inArray(offers.id, createdOfferIds));
		createdOfferIds.length = 0;
	}
}

async function cleanupProducts() {
	if (createdProductIds.length > 0) {
		// Junction rows also cascade with the product; deleting them explicitly
		// keeps the cleanup order obvious.
		await db.delete(offerProducts).where(inArray(offerProducts.productId, createdProductIds));
		await db.delete(products).where(inArray(products.id, createdProductIds));
		createdProductIds.length = 0;
	}
}

afterEach(async () => {
	await cleanupOffers();
	await cleanupProducts();
});

// ── Pure logic tests (no DB) ────────────────────────────

describe("pure logic", () => {
	describe("makeSlug", () => {
		it("generates lowercase, URL-safe slug from a name", () => {
			expect(makeSlug("Cyber Monday 2024")).toBe("cyber-monday-2024");
		});

		it("handles special characters", () => {
			expect(makeSlug("Oferta! @#$% Loca")).toBe("oferta-dollarpercent-loca");
		});

		it("strips leading/trailing whitespace and dashes", () => {
			expect(makeSlug("  -- Hola Mundo --  ")).toBe("hola-mundo");
		});

		it("returns empty string for empty input", () => {
			expect(makeSlug("")).toBe("");
		});
	});

	describe("TypeBox schema — overrideDiscountType removed", () => {
		it("createBody accepts overrides with only overrideDiscountValue", () => {
			const valid = Value.Check(OfferModel.createBody, {
				name: "Test Offer",
				discountValue: 25,
				startsAt: new Date(Date.now() + 86400000).toISOString(),
				endsAt: new Date(Date.now() + 172800000).toISOString(),
				overrides: {
					"00000000-0000-0000-0000-000000000001": {
						overrideDiscountValue: 50,
					},
				},
			});
			expect(valid).toBe(true);
		});
	});
});

// ── DB-dependent tests ───────────────────────────────────

describeDb("OfferService (DB)", () => {
	describe("create", () => {
		it("rejects discountValue > 100", async () => {
			await expect(
				OfferService.create(
					{
						name: "Too High Discount",
						discountValue: 150,
						startsAt: new Date(Date.now() + 86400000).toISOString(),
						endsAt: new Date(Date.now() + 172800000).toISOString(),
					},
					testUserId,
				),
			).rejects.toThrow();
		});

		it("rejects endsAt <= startsAt", async () => {
			await expect(
				OfferService.create(
					{
						name: "Bad Dates",
						discountValue: 25,
						startsAt: new Date(Date.now() + 172800000).toISOString(),
						endsAt: new Date(Date.now() + 86400000).toISOString(),
					},
					testUserId,
				),
			).rejects.toThrow();
		});

		it("rejects unknown productIds", async () => {
			await expect(
				OfferService.create(
					{
						name: "Bad Products",
						discountValue: 25,
						startsAt: new Date(Date.now() + 86400000).toISOString(),
						endsAt: new Date(Date.now() + 172800000).toISOString(),
						productIds: ["00000000-0000-0000-0000-000000000099"],
					},
					testUserId,
				),
			).rejects.toThrow("no existen");
		});

		it("rejects duplicate slug", async () => {
			const slug = uniqueSlug("dup");
			const offer = await OfferService.create(
				{
					name: "First Offer",
					slug,
					discountValue: 10,
					startsAt: new Date(Date.now() + 86400000).toISOString(),
					endsAt: new Date(Date.now() + 172800000).toISOString(),
				},
				testUserId,
			);
			createdOfferIds.push(offer.id);

			await expect(
				OfferService.create(
					{
						name: "Duplicate Slug",
						slug,
						discountValue: 10,
						startsAt: new Date(Date.now() + 86400000).toISOString(),
						endsAt: new Date(Date.now() + 172800000).toISOString(),
					},
					testUserId,
				),
			).rejects.toThrow();
		});

		it("creates an offer with products and returns it", async () => {
			const slug = uniqueSlug("create-wp");
			const offer = await OfferService.create(
				{
					name: "With Products",
					slug,
					discountValue: 15,
					startsAt: new Date(Date.now() + 86400000).toISOString(),
					endsAt: new Date(Date.now() + 172800000).toISOString(),
					productIds: [sampleProductId],
				},
				testUserId,
			);
			createdOfferIds.push(offer.id);

			expect(offer.name).toBe("With Products");
			expect(offer.slug).toBe(slug);

			// Verify junction rows exist
			const junc = await db.select().from(offerProducts).where(eq(offerProducts.offerId, offer.id));
			expect(junc.length).toBe(1);
			expect(junc[0]!.productId).toBe(sampleProductId);
		});
	});

	describe("update", () => {
		it("rejects endsAt before existing startsAt when both are provided", async () => {
			const slug = uniqueSlug("update-date");
			const offer = await OfferService.create(
				{
					name: "Update Dates",
					slug,
					discountValue: 10,
					startsAt: new Date("2025-06-01").toISOString(),
					endsAt: new Date("2025-06-30").toISOString(),
				},
				testUserId,
			);
			createdOfferIds.push(offer.id);

			await expect(
				OfferService.update(
					offer.id,
					{
						startsAt: new Date("2025-07-01").toISOString(),
						endsAt: new Date("2025-06-15").toISOString(),
					},
					testUserId,
				),
			).rejects.toThrow();
		});

		it("rejects productIds: [] (empty array guard)", async () => {
			const slug = uniqueSlug("update-empty");
			const offer = await OfferService.create(
				{
					name: "Empty Products Guard",
					slug,
					discountValue: 10,
					startsAt: new Date(Date.now() + 86400000).toISOString(),
					endsAt: new Date(Date.now() + 172800000).toISOString(),
				},
				testUserId,
			);
			createdOfferIds.push(offer.id);

			await expect(OfferService.update(offer.id, { productIds: [] }, testUserId)).rejects.toThrow();
		});

		it("updates offer fields", async () => {
			const slug = uniqueSlug("update-fields");
			const offer = await OfferService.create(
				{
					name: "Original",
					slug,
					discountValue: 10,
					startsAt: new Date(Date.now() + 86400000).toISOString(),
					endsAt: new Date(Date.now() + 172800000).toISOString(),
				},
				testUserId,
			);
			createdOfferIds.push(offer.id);

			const updated = await OfferService.update(
				offer.id,
				{ name: "Updated", discountValue: 20 },
				testUserId,
			);
			expect(updated.name).toBe("Updated");
			expect(updated.discountValue.toString()).toBe("20.00");
		});
	});

	describe("delete (soft)", () => {
		it("sets isActive = false and preserves junction rows", async () => {
			const slug = uniqueSlug("del-soft");
			const offer = await OfferService.create(
				{
					name: "To Delete",
					slug,
					discountValue: 10,
					startsAt: new Date(Date.now() + 86400000).toISOString(),
					endsAt: new Date(Date.now() + 172800000).toISOString(),
					productIds: [sampleProductId],
				},
				testUserId,
			);
			createdOfferIds.push(offer.id);

			const deleted = await OfferService.delete(offer.id);
			expect(deleted.isActive).toBe(false);

			// Junction rows preserved
			const junc = await db.select().from(offerProducts).where(eq(offerProducts.offerId, offer.id));
			expect(junc.length).toBe(1);
		});
	});

	describe("assignProducts", () => {
		it("is idempotent — calling twice with same products produces same state", async () => {
			const slug = uniqueSlug("assign-idem");
			const offer = await OfferService.create(
				{
					name: "Idempotent",
					slug,
					discountValue: 10,
					startsAt: new Date(Date.now() + 86400000).toISOString(),
					endsAt: new Date(Date.now() + 172800000).toISOString(),
				},
				testUserId,
			);
			createdOfferIds.push(offer.id);

			await OfferService.assignProducts(offer.id, [sampleProductId]);
			const junc1 = await db
				.select()
				.from(offerProducts)
				.where(eq(offerProducts.offerId, offer.id));

			await OfferService.assignProducts(offer.id, [sampleProductId]);
			const junc2 = await db
				.select()
				.from(offerProducts)
				.where(eq(offerProducts.offerId, offer.id));

			expect(junc2.length).toBe(junc1.length);
			expect(junc2[0]!.productId).toBe(sampleProductId);
		});

		it("clears overrideDiscountValue when null is passed", async () => {
			const slug = uniqueSlug("assign-clears");
			const offer = await OfferService.create(
				{
					name: "Override Clear",
					slug,
					discountValue: 10,
					startsAt: new Date(Date.now() + 86400000).toISOString(),
					endsAt: new Date(Date.now() + 172800000).toISOString(),
					productIds: [sampleProductId],
					overrides: {
						[sampleProductId]: { overrideDiscountValue: 50 },
					},
				},
				testUserId,
			);
			createdOfferIds.push(offer.id);

			const [juncBefore] = await db
				.select()
				.from(offerProducts)
				.where(
					and(eq(offerProducts.offerId, offer.id), eq(offerProducts.productId, sampleProductId)),
				);
			expect(juncBefore?.overrideDiscountValue).not.toBeNull();

			await OfferService.assignProducts(offer.id, [sampleProductId], {
				[sampleProductId]: { overrideDiscountValue: null },
			});

			const [juncAfter] = await db
				.select()
				.from(offerProducts)
				.where(
					and(eq(offerProducts.offerId, offer.id), eq(offerProducts.productId, sampleProductId)),
				);
			expect(juncAfter?.overrideDiscountValue).toBeNull();
		});
	});

	describe("list()", () => {
		it("returns { data, total } and total matches", async () => {
			const slug1 = uniqueSlug("list-a");
			const slug2 = uniqueSlug("list-b");
			const o1 = await OfferService.create(
				{
					name: "List A",
					slug: slug1,
					discountValue: 10,
					startsAt: new Date(Date.now() + 86400000).toISOString(),
					endsAt: new Date(Date.now() + 172800000).toISOString(),
				},
				testUserId,
			);
			createdOfferIds.push(o1.id);
			const o2 = await OfferService.create(
				{
					name: "List B",
					slug: slug2,
					discountValue: 20,
					startsAt: new Date(Date.now() + 86400000).toISOString(),
					endsAt: new Date(Date.now() + 172800000).toISOString(),
				},
				testUserId,
			);
			createdOfferIds.push(o2.id);

			const result = await OfferService.list({ limit: 100, offset: 0 });
			expect(result).toHaveProperty("data");
			expect(result).toHaveProperty("total");
			expect(Array.isArray(result.data)).toBe(true);
			expect(typeof result.total).toBe("number");
			expect(result.total).toBeGreaterThanOrEqual(2);
		});

		it("paginates correctly (offset/limit)", async () => {
			const slugA = uniqueSlug("page-a");
			const slugB = uniqueSlug("page-b");
			const o1 = await OfferService.create(
				{
					name: "Paginate A",
					slug: slugA,
					discountValue: 10,
					startsAt: new Date(Date.now() + 86400000).toISOString(),
					endsAt: new Date(Date.now() + 172800000).toISOString(),
				},
				testUserId,
			);
			createdOfferIds.push(o1.id);
			const o2 = await OfferService.create(
				{
					name: "Paginate B",
					slug: slugB,
					discountValue: 10,
					startsAt: new Date(Date.now() + 86400000).toISOString(),
					endsAt: new Date(Date.now() + 172800000).toISOString(),
				},
				testUserId,
			);
			createdOfferIds.push(o2.id);

			const page1 = await OfferService.list({ limit: 1, offset: 0 });
			expect(page1.data.length).toBe(1);

			const page2 = await OfferService.list({ limit: 1, offset: 1 });
			expect(page2.data.length).toBe(1);

			expect(page1.data[0]!.id).not.toBe(page2.data[0]!.id);
		});
	});

	describe("getActiveOffersForProducts", () => {
		it("returns empty Map for admin role", async () => {
			const slug = uniqueSlug("admin-empty");
			const offer = await OfferService.create(
				{
					name: "Admin Test",
					slug,
					discountValue: 10,
					startsAt: new Date(Date.now() - 86400000).toISOString(),
					endsAt: new Date(Date.now() + 86400000).toISOString(),
					productIds: [sampleProductId],
				},
				testUserId,
			);
			createdOfferIds.push(offer.id);

			const result = await OfferService.getActiveOffersForProducts("admin", [sampleProductId]);
			expect(result.size).toBe(0);
		});

		it("returns active offers for customer role", async () => {
			const slug = uniqueSlug("cust-active");
			const offer = await OfferService.create(
				{
					name: "Customer Test",
					slug,
					discountValue: 15,
					startsAt: new Date(Date.now() - 86400000).toISOString(),
					endsAt: new Date(Date.now() + 86400000).toISOString(),
					isActive: true,
					productIds: [sampleProductId],
				},
				testUserId,
			);
			createdOfferIds.push(offer.id);

			const result = await OfferService.getActiveOffersForProducts("customer", [sampleProductId]);
			expect(result.size).toBe(1);
			expect(result.get(sampleProductId)?.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("getOffersWithProducts", () => {
		it("filters by brandId at offer level", async () => {
			if (!sampleBrandId) {
				throw new Error("Sample product has no brand — cannot test brandId filtering");
			}

			const slug = uniqueSlug("brand-filter");
			const offer = await OfferService.create(
				{
					name: "Brand Filter Test",
					slug,
					discountValue: 10,
					startsAt: new Date(Date.now() - 86400000).toISOString(),
					endsAt: new Date(Date.now() + 86400000).toISOString(),
					isActive: true,
					productIds: [sampleProductId],
				},
				testUserId,
			);
			createdOfferIds.push(offer.id);

			const result = await OfferService.getOffersWithProducts("customer", {
				brandSlugs: sampleBrandSlug,
				limit: 100,
			});

			expect(result.offers.length).toBeGreaterThanOrEqual(1);
			for (const o of result.offers) {
				for (const p of o.products.items) {
					expect(p.brand?.id).toBe(sampleBrandId);
				}
			}
		});

		it("paginates the price-filtered product set without repeating page 1", async () => {
			const marginRules = await getActiveMarginRules();
			const suppliers = [100, 200, 300, 400, 500];
			const discountValue = 10;

			const inserted = await db
				.insert(products)
				.values(
					suppliers.map((price, i) => ({
						name: `OfferPrice ${i} ${suffix}`,
						slug: `offer-price-${i}-${suffix}`,
						sku: `OFFERPRICE-${i}-${suffix}`,
						price: price.toFixed(2),
						supplierPrice: price.toFixed(2),
						roleCustomMargins: { customer: { enabled: true as const, percent: "0" } },
						stock: 10,
					})),
				)
				.returning({
					id: products.id,
					supplierPrice: products.supplierPrice,
					roleCustomMargins: products.roleCustomMargins,
				});
			createdProductIds.push(...inserted.map((p) => p.id));

			const offer = await OfferService.create(
				{
					name: `Offer Price Page ${suffix}`,
					slug: uniqueSlug("offer-price-page"),
					discountValue,
					startsAt: new Date(Date.now() - 86_400_000).toISOString(),
					endsAt: new Date(Date.now() + 86_400_000).toISOString(),
					isActive: true,
					productIds: inserted.map((p) => p.id),
				},
				testUserId,
			);
			createdOfferIds.push(offer.id);

			// Expected effective prices from the pricing SSOT, never from the
			// service output.
			const effective = inserted
				.map((p) => ({
					id: p.id,
					price: applyOfferToProduct(
						getEffectiveSalePrice(
							{ supplierPrice: p.supplierPrice, roleCustomMargins: p.roleCustomMargins },
							"customer",
							marginRules,
						).salePrice,
						[{ id: offer.id, discountValue }],
						"customer",
					).discountedPrice,
				}))
				.sort((a, b) => a.price - b.price);
			expect(effective.length).toBe(5);

			const minPrice = effective[1]!.price;
			const maxPrice = effective[4]!.price;
			const matching = effective.filter((e) => e.price >= minPrice && e.price <= maxPrice);
			expect(matching.length).toBeLessThan(effective.length); // the filter must filter
			expect(matching.length).toBeGreaterThan(1);

			const page1 = await OfferService.getOffersWithProducts("customer", {
				offerId: offer.id,
				productsOffset: 0,
				productsLimit: 2,
				minPrice: String(minPrice),
				maxPrice: String(maxPrice),
			});
			const page2 = await OfferService.getOffersWithProducts("customer", {
				offerId: offer.id,
				productsOffset: 2,
				productsLimit: 2,
				minPrice: String(minPrice),
				maxPrice: String(maxPrice),
			});

			const section1 = page1.offers[0]!;
			const section2 = page2.offers[0]!;
			expect(section1.products.total).toBe(matching.length);
			expect(section2.products.total).toBe(matching.length);
			expect(section1.products.items.map((i) => i.id)).toEqual(
				matching.slice(0, 2).map((m) => m.id),
			);
			expect(section2.products.items.map((i) => i.id)).toEqual(matching.slice(2).map((m) => m.id));
			expect(section1.products.nextOffset).toBe(2);
			expect(section2.products.nextOffset).toBeNull();

			const seen = new Set(
				[...section1.products.items, ...section2.products.items].map((i) => i.id),
			);
			expect(seen.size).toBe(matching.length);
		});

		it("returns no offers when the brand slugs resolve to no brand", async () => {
			// An active offer exists, so the old behavior (no brand condition when
			// nothing resolves) would have returned it.
			const offer = await OfferService.create(
				{
					name: `Ghost Brand ${suffix}`,
					slug: uniqueSlug("ghost-brand"),
					discountValue: 10,
					startsAt: new Date(Date.now() - 86_400_000).toISOString(),
					endsAt: new Date(Date.now() + 86_400_000).toISOString(),
					isActive: true,
					productIds: [sampleProductId],
				},
				testUserId,
			);
			createdOfferIds.push(offer.id);

			const result = await OfferService.getOffersWithProducts("customer", {
				brandSlugs: `ghost-brand-${suffix}`,
				limit: 100,
			});

			expect(result.offers).toEqual([]);
			expect(Array.isArray(result.filters.brands)).toBe(true);
		});
	});
});

afterAll(async () => {
	await cleanupOffers();
	await cleanupProducts();
});
