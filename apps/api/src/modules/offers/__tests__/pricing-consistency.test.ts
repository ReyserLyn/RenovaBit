/**
 * Pricing consistency across catalog, cart, checkout and the offers page.
 *
 * Regression guard for the "displayed price equals charged price" invariant:
 * a per-product offer override and overlapping campaigns must resolve to the
 * same effective price everywhere, and only the best offer applies.
 *
 * Prerequisites:
 *   - Dev Postgres running (`docker compose -f docker-compose.dev.yaml up -d`)
 *   - `DATABASE_URL` pointing to the dev DB (loaded from packages/db/.env)
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@renovabit/db";
import {
	adminNotifications,
	cartItems,
	carts,
	offerProducts,
	offers,
	orders,
	products,
	users,
} from "@renovabit/db/schema";
import { applyOfferToProduct } from "@renovabit/pricing";
import { eq, inArray, sql } from "drizzle-orm";
import { removeOrderAutoCancel } from "@/jobs/orders.queue";
import { CartService } from "@/modules/cart/service";
import { OrderService } from "@/modules/orders/service";
import { ProductService } from "@/modules/products/service";
import { OfferService } from "../service";

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
const GUEST_TOKEN = `guest-pricing-${suffix}`;

// Product: supplier cost 100 with a 50% customer margin → customer sale price
// is pinned at 150 regardless of the dev margin rules.
const SUPPLIER_PRICE = "100.00";
const SALE_PRICE = "150.00";

let userId: string;
let productId: string;
let productSlug: string;
let offerIds: string[] = [];
let cartId: string;
let orderId: string | null = null;

beforeAll(async () => {
	if (!dbAvailable) return;

	const [user] = await db
		.insert(users)
		.values({
			name: "Pricing Consistency User",
			email: `pricing-consistency-${suffix}@example.com`,
		})
		.returning({ id: users.id });
	userId = user!.id;

	productSlug = `pricing-consistency-${suffix}`;
	const [product] = await db
		.insert(products)
		.values({
			name: `Pricing Consistency ${suffix}`,
			slug: productSlug,
			sku: `PRICING-${suffix}`,
			price: SALE_PRICE,
			supplierPrice: SUPPLIER_PRICE,
			roleCustomMargins: { customer: { enabled: true, percent: "50" } },
			stock: 50,
		})
		.returning({ id: products.id });
	productId = product!.id;

	const window = {
		startsAt: new Date(Date.now() - 86_400_000).toISOString(),
		endsAt: new Date(Date.now() + 86_400_000).toISOString(),
	};

	// Campaign A: base 10% but a 50% override for this product.
	const offerWithOverride = await OfferService.create(
		{
			name: `Pricing Override ${suffix}`,
			slug: `pricing-override-${suffix}`,
			discountValue: 10,
			isActive: true,
			...window,
			productIds: [productId],
			overrides: { [productId]: { overrideDiscountValue: 50 } },
		},
		userId,
	);
	// Campaign B: base 20%, no override.
	const offerBase = await OfferService.create(
		{
			name: `Pricing Base ${suffix}`,
			slug: `pricing-base-${suffix}`,
			discountValue: 20,
			isActive: true,
			...window,
			productIds: [productId],
		},
		userId,
	);
	offerIds = [offerWithOverride.id, offerBase.id];

	const [cart] = await db
		.insert(carts)
		.values({ guestToken: GUEST_TOKEN, itemsCount: 1, lastActivityAt: new Date() })
		.returning({ id: carts.id });
	cartId = cart!.id;

	await db.insert(cartItems).values({
		cartId,
		productId,
		quantity: 1,
		addedAtPrice: "0.00",
	});
});

afterAll(async () => {
	if (!dbAvailable) return;

	// Notifications are inserted fire-and-forget by create(); give them a beat.
	await new Promise((resolve) => setTimeout(resolve, 250));
	if (orderId) {
		await db
			.delete(adminNotifications)
			.where(sql`${adminNotifications.data}->>'orderId' = ${orderId}`);
		await db.delete(orders).where(eq(orders.id, orderId));
		removeOrderAutoCancel(orderId).catch(() => {
			/* best-effort cleanup */
		});
	}

	if (offerIds.length > 0) {
		await db.delete(offerProducts).where(inArray(offerProducts.offerId, offerIds));
		await db.delete(offers).where(inArray(offers.id, offerIds));
	}
	await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
	await db.delete(carts).where(eq(carts.id, cartId));
	await db.delete(products).where(eq(products.id, productId));
	await db.delete(users).where(eq(users.id, userId));
});

// ── Tests ────────────────────────────────────────────────────────────────

describeDb("pricing consistency (DB)", () => {
	it("catalog shows the effective override discount and the charged price", async () => {
		const detail = await ProductService.getBySlugPublic(productSlug, "customer");
		expect(detail).not.toBeNull();

		// Base price pinned by the per-product margin; best offer (50% override)
		// must win over the 20% of the other campaign.
		expect(detail!.price).toBe(SALE_PRICE);
		expect(detail!.offerPrice).toBe("75.00");
		expect(detail!.discountPercent).toBe(50);

		// The catalog subquery must carry the EFFECTIVE discount per product.
		const effective = detail!.offers
			.map((o) => Number.parseFloat(o.discountValue))
			.sort((a, b) => a - b);
		expect(effective).toEqual([20, 50]);
	});

	it("the cart offer resolution matches the catalog", async () => {
		const map = await OfferService.getActiveOffersForProducts("customer", [productId]);
		const values = (map.get(productId) ?? []).map((o) => o.discountValue).sort((a, b) => a - b);
		expect(values).toEqual([20, 50]);

		// Best offer wins: 50% off 150 = 75, not 150 - 50% - 20%.
		const { discountedPrice } = applyOfferToProduct(150, map.get(productId) ?? [], "customer");
		expect(discountedPrice).toBe(75);
	});

	it("the offers page shows the price the customer actually pays", async () => {
		const result = await OfferService.getOffersWithProducts("customer", {
			limit: 50,
			productsLimit: 100,
		});

		const occurrences: Array<{ offerPrice: string | null; basePrice: string }> = [];
		for (const offer of result.offers) {
			for (const item of offer.products.items) {
				if (item.id === productId) {
					occurrences.push({ offerPrice: item.offerPrice, basePrice: item.basePrice });
				}
			}
		}

		expect(occurrences.length).toBeGreaterThanOrEqual(1);
		for (const occurrence of occurrences) {
			expect(occurrence.basePrice).toBe(SALE_PRICE);
			expect(occurrence.offerPrice).toBe("75.00");
		}
	});

	it("cart total and checkout charge the catalog price", async () => {
		const total = await CartService.getTotalByOwner(null, GUEST_TOKEN, "customer");
		expect(total.subtotal).toBe("75.00");

		const order = await OrderService.create(
			{
				cartId,
				guestToken: GUEST_TOKEN,
				customerName: "Pricing Test",
				customerPhone: "999888777",
			},
			null,
		);
		orderId = order.id;

		expect(order.total).toBe("75.00");
		expect(order.discountTotal).toBe("75.00");
		expect(order.items[0]!.unitPrice).toBe(SALE_PRICE);
		expect(order.items[0]!.finalPrice).toBe("75.00");
	});
});
