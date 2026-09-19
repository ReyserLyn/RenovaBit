/**
 * Cart purchasability mirrors the public visibility rule: an advisory review
 * reason ("Sin imagen") flags the operator but must not block the cart, while
 * a blocking reason (missing brand, invalid price, ...) still does.
 *
 * Every fixture carries `needsReview = true`, so these tests fail on the old
 * raw `needsReview` rejection. The guard now delegates to `isPurchasable` /
 * `hasBlockingReviewReason` (utils/product-visibility.ts), the TS twin of the
 * SQL predicate behind every public query.
 *
 * Prerequisites: dev Postgres running (`docker compose -f docker-compose.dev.yaml up -d`).
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@renovabit/db";
import { cartItems, carts, products, users } from "@renovabit/db/schema";
import { eq, inArray } from "drizzle-orm";
import { REVIEW_REASONS } from "@/utils/review-reasons";
import { CartService } from "../service";

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

// ── Fixtures ─────────────────────────────────────────────────────────────

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let advisoryId: string;
let advisoryPlusBlockingId: string;
let blockingId: string;
let flagWithoutReasonId: string;

const createdCartIds: string[] = [];
const createdProductIds: string[] = [];

beforeAll(async () => {
	if (!dbAvailable) return;

	const rows = await db
		.insert(products)
		.values([
			{
				name: `CartTest Advisory ${suffix}`,
				slug: `carttest-advisory-${suffix}`,
				sku: `CARTTEST-ADVISORY-${suffix}`,
				price: "10.00",
				supplierPrice: "10.00",
				stock: 10,
				needsReview: true,
				reviewReason: REVIEW_REASONS.missingImage,
			},
			{
				name: `CartTest Advisory Plus Blocking ${suffix}`,
				slug: `carttest-advisory-blocking-${suffix}`,
				sku: `CARTTEST-ADVISORY-BLOCKING-${suffix}`,
				price: "10.00",
				supplierPrice: "10.00",
				stock: 10,
				needsReview: true,
				reviewReason: `${REVIEW_REASONS.missingImage}; ${REVIEW_REASONS.missingBrand}`,
			},
			{
				name: `CartTest Blocking ${suffix}`,
				slug: `carttest-blocking-${suffix}`,
				sku: `CARTTEST-BLOCKING-${suffix}`,
				price: "10.00",
				supplierPrice: "10.00",
				stock: 10,
				needsReview: true,
				reviewReason: REVIEW_REASONS.missingBrand,
			},
			{
				// Flag set without a reason: nothing actionable tells the operator
				// what to fix, so the product is purchasable (same as the SQL rule).
				name: `CartTest Flag No Reason ${suffix}`,
				slug: `carttest-flag-no-reason-${suffix}`,
				sku: `CARTTEST-FLAG-NO-REASON-${suffix}`,
				price: "10.00",
				supplierPrice: "10.00",
				stock: 10,
				needsReview: true,
				reviewReason: null,
			},
		])
		.returning({ id: products.id });

	advisoryId = rows[0]!.id;
	advisoryPlusBlockingId = rows[1]!.id;
	blockingId = rows[2]!.id;
	flagWithoutReasonId = rows[3]!.id;

	createdProductIds.push(advisoryId, advisoryPlusBlockingId, blockingId, flagWithoutReasonId);
});

afterAll(async () => {
	if (!dbAvailable) return;
	if (createdCartIds.length > 0) {
		await db.delete(cartItems).where(inArray(cartItems.cartId, createdCartIds));
		await db.delete(carts).where(inArray(carts.id, createdCartIds));
	}
	await db.delete(products).where(inArray(products.id, createdProductIds));
});

async function createGuestCart(label: string): Promise<{ id: string; token: string }> {
	const token = `guest-carttest-${label}-${suffix}`;
	const [cart] = await db
		.insert(carts)
		.values({ guestToken: token, itemsCount: 0, lastActivityAt: new Date() })
		.returning({ id: carts.id });
	const id = cart!.id;
	createdCartIds.push(id);
	return { id, token };
}

// ── Tests ────────────────────────────────────────────────────────────────

describeDb("CartService purchasability with review reasons (DB)", () => {
	it("adds an advisory-only product (Sin imagen) and leaves its review data intact", async () => {
		const cart = await createGuestCart("advisory");

		const result = await CartService.addItem(
			cart.id,
			{ productId: advisoryId, quantity: 1 },
			"customer",
		);

		const line = result.items.find((item) => item.productId === advisoryId);
		expect(line?.status).toBe("available");

		// Purchase gating is read-only: the operator keeps seeing the flag.
		const [row] = await db
			.select({ needsReview: products.needsReview, reviewReason: products.reviewReason })
			.from(products)
			.where(eq(products.id, advisoryId))
			.limit(1);
		expect(row?.needsReview).toBe(true);
		expect(row?.reviewReason).toBe(REVIEW_REASONS.missingImage);
	});

	it("adds a product flagged for review with no reason", async () => {
		const cart = await createGuestCart("flag-no-reason");

		const result = await CartService.addItem(
			cart.id,
			{ productId: flagWithoutReasonId, quantity: 1 },
			"customer",
		);

		expect(result.items.find((item) => item.productId === flagWithoutReasonId)).toBeDefined();
	});

	it("rejects a product with a blocking review reason", async () => {
		const cart = await createGuestCart("blocking");

		await expect(
			CartService.addItem(cart.id, { productId: blockingId, quantity: 1 }, "customer"),
		).rejects.toThrow(/no está disponible/);

		const lines = await db
			.select({ id: cartItems.id })
			.from(cartItems)
			.where(eq(cartItems.cartId, cart.id));
		expect(lines.length).toBe(0);
	});

	it("rejects a product when an advisory reason coexists with a blocking one", async () => {
		const cart = await createGuestCart("advisory-blocking");

		await expect(
			CartService.addItem(cart.id, { productId: advisoryPlusBlockingId, quantity: 1 }, "customer"),
		).rejects.toThrow(/no está disponible/);
	});

	it("refreshes cart status consistently: advisory orderable, blocking unavailable", async () => {
		const cart = await createGuestCart("refresh-status");
		await db.insert(cartItems).values([
			{ cartId: cart.id, productId: advisoryId, quantity: 1, addedAtPrice: "0.00" },
			{ cartId: cart.id, productId: blockingId, quantity: 1, addedAtPrice: "0.00" },
		]);

		const refreshed = await CartService.requireCart(null, cart.token, "customer");

		const advisoryLine = refreshed.items.find((item) => item.productId === advisoryId);
		const blockingLine = refreshed.items.find((item) => item.productId === blockingId);

		// The advisory line stays orderable ("price_changed" is just the stale
		// addedAtPrice snapshot); only the blocking line is unavailable.
		expect(advisoryLine).toBeDefined();
		expect(blockingLine).toBeDefined();
		expect(["available", "price_changed"]).toContain(advisoryLine!.status);
		expect(blockingLine!.status).toBe("unavailable");
		expect(blockingLine!.statusMessage).toBe("Producto no disponible");
	});
});
