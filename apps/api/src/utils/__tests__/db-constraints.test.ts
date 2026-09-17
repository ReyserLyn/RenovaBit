/**
 * Database-level constraint guards.
 *
 * These constraints are defense in depth behind the API validations: rows
 * written directly (scripts, future code paths) must still be rejected.
 * Requires the dev Postgres with migration 0004 applied.
 */
import { afterAll, describe, expect, it } from "bun:test";
import { db } from "@renovabit/db";
import { marginRules, offerProducts, offers, products, users } from "@renovabit/db/schema";
import { inArray } from "drizzle-orm";

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

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds: string[] = [];
const createdProductIds: string[] = [];
const createdOfferIds: string[] = [];

/** Drizzle builders are thenables, not Promises — `rejects` needs a Promise. */
function promiseOf<T>(query: PromiseLike<T>): Promise<T> {
	return Promise.resolve(query);
}

afterAll(async () => {
	if (!dbAvailable) return;
	if (createdOfferIds.length > 0) {
		await db.delete(offerProducts).where(inArray(offerProducts.offerId, createdOfferIds));
		await db.delete(offers).where(inArray(offers.id, createdOfferIds));
	}
	if (createdProductIds.length > 0) {
		await db.delete(products).where(inArray(products.id, createdProductIds));
	}
	if (createdUserIds.length > 0) {
		await db.delete(users).where(inArray(users.id, createdUserIds));
	}
});

describeDb("database constraints (DB)", () => {
	it("rejects duplicate usernames", async () => {
		const username = `dup-${suffix}`;
		const [first] = await db
			.insert(users)
			.values({ name: "Constraint A", email: `constraint-a-${suffix}@example.com`, username })
			.returning({ id: users.id });
		createdUserIds.push(first!.id);

		await expect(
			promiseOf(
				db
					.insert(users)
					.values({
						name: "Constraint B",
						email: `constraint-b-${suffix}@example.com`,
						username,
					})
					.returning({ id: users.id }),
			),
		).rejects.toThrow();
	});

	it("rejects negative stock and negative prices", async () => {
		await expect(
			promiseOf(
				db
					.insert(products)
					.values({
						name: `Constraint Neg Stock ${suffix}`,
						slug: `constraint-neg-stock-${suffix}`,
						sku: `CNEG-S-${suffix}`,
						price: "10.00",
						supplierPrice: "5.00",
						stock: -1,
					})
					.returning({ id: products.id }),
			),
		).rejects.toThrow();

		await expect(
			promiseOf(
				db
					.insert(products)
					.values({
						name: `Constraint Neg Price ${suffix}`,
						slug: `constraint-neg-price-${suffix}`,
						sku: `CNEG-P-${suffix}`,
						price: "-1.00",
						supplierPrice: "5.00",
						stock: 1,
					})
					.returning({ id: products.id }),
			),
		).rejects.toThrow();
	});

	it("rejects inverted margin ranges", async () => {
		await expect(
			promiseOf(
				db
					.insert(marginRules)
					.values({
						name: `Constraint Inverted ${suffix}`,
						minPrice: "100.00",
						maxPrice: "50.00",
						customerPct: "30.00",
					})
					.returning({ id: marginRules.id }),
			),
		).rejects.toThrow();
	});

	it("rejects out-of-range offer overrides", async () => {
		const [product] = await db
			.insert(products)
			.values({
				name: `Constraint Override ${suffix}`,
				slug: `constraint-override-${suffix}`,
				sku: `COVR-${suffix}`,
				price: "10.00",
				supplierPrice: "5.00",
				stock: 1,
			})
			.returning({ id: products.id });
		createdProductIds.push(product!.id);

		const [offer] = await db
			.insert(offers)
			.values({
				name: `Constraint Offer ${suffix}`,
				slug: `constraint-offer-${suffix}`,
				discountValue: "10.00",
				startsAt: new Date(Date.now() - 86_400_000),
				endsAt: new Date(Date.now() + 86_400_000),
				isActive: true,
			})
			.returning({ id: offers.id });
		createdOfferIds.push(offer!.id);

		await expect(
			promiseOf(
				db.insert(offerProducts).values({
					offerId: offer!.id,
					productId: product!.id,
					overrideDiscountValue: "150.00",
				}),
			),
		).rejects.toThrow();
	});
});
