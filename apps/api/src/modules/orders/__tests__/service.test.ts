/**
 * OrderService integration tests.
 *
 * Covers the checkout contract this storefront depends on:
 *   - retries of a completed checkout return the same order (idempotent replay)
 *   - a consumed cart can be refilled and checked out again (second purchase)
 *   - concurrent double-submits converge to one order
 *   - admin notes never leak to order owners
 *   - concurrent status updates can't double-move stock
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
	orderItems,
	orders,
	products,
	users,
} from "@renovabit/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { removeOrderAutoCancel } from "@/jobs/orders.queue";
import { OrderService } from "../service";

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
const GUEST_TOKEN = `guest-${suffix}`;
const ORDER_CONTEXT = { customerName: "Test Buyer", customerPhone: "999888777" };

let userAId: string;
let productAId: string;
let productBId: string;
let cartAId: string;
let guestCartId: string;

const createdOrderIds: string[] = [];
const createdCartIds: string[] = [];
const createdProductIds: string[] = [];

let orderNumberCounter = 0;

beforeAll(async () => {
	if (!dbAvailable) return;

	const [user] = await db
		.insert(users)
		.values({ name: "Orders Test User", email: `orders-test-${suffix}@example.com` })
		.returning({ id: users.id });
	userAId = user!.id;

	// Product A: plenty of stock for checkout/replay tests.
	const [productA] = await db
		.insert(products)
		.values({
			name: `OrderTest Alpha ${suffix}`,
			slug: `ordertest-alpha-${suffix}`,
			sku: `ORDERTEST-A-${suffix}`,
			price: "200.00",
			supplierPrice: "100.00",
			stock: 100,
		})
		.returning({ id: products.id });
	productAId = productA!.id;

	// Product B: small stock for the race test.
	const [productB] = await db
		.insert(products)
		.values({
			name: `OrderTest Bravo ${suffix}`,
			slug: `ordertest-bravo-${suffix}`,
			sku: `ORDERTEST-B-${suffix}`,
			price: "200.00",
			supplierPrice: "100.00",
			stock: 10,
		})
		.returning({ id: products.id });
	productBId = productB!.id;

	createdProductIds.push(productAId, productBId);

	const [cart] = await db
		.insert(carts)
		.values({ userId: userAId, itemsCount: 0, lastActivityAt: new Date() })
		.returning({ id: carts.id });
	cartAId = cart!.id;

	const [guestCart] = await db
		.insert(carts)
		.values({ guestToken: GUEST_TOKEN, itemsCount: 0, lastActivityAt: new Date() })
		.returning({ id: carts.id });
	guestCartId = guestCart!.id;

	createdCartIds.push(cartAId, guestCartId);
});

async function addCartItem(cartId: string, productId: string, quantity: number): Promise<void> {
	await db.insert(cartItems).values({ cartId, productId, quantity, addedAtPrice: "0.00" });
}

async function fetchOrderRow(orderId: string): Promise<{ cartId: string | null; status: string }> {
	const [row] = await db
		.select({ cartId: orders.cartId, status: orders.status })
		.from(orders)
		.where(eq(orders.id, orderId))
		.limit(1);
	return row!;
}

/** Inserts a pending order directly (no checkout side effects). */
async function insertPendingOrder(opts: {
	userId: string;
	productId: string;
	quantity: number;
	adminNotes?: string;
}): Promise<string> {
	orderNumberCounter += 1;
	const now = new Date();
	const [order] = await db
		.insert(orders)
		.values({
			userId: opts.userId,
			orderNumber: `TEST-${suffix}-${orderNumberCounter}`,
			status: "pending",
			source: "web",
			customerName: "Direct Insert",
			subtotal: "300.00",
			discountTotal: "0.00",
			total: "300.00",
			adminNotes: opts.adminNotes ?? null,
			createdAt: now,
			updatedAt: now,
		})
		.returning({ id: orders.id });
	const orderId = order!.id;
	createdOrderIds.push(orderId);

	await db.insert(orderItems).values({
		orderId,
		productId: opts.productId,
		productName: "Direct Item",
		productSku: "DIRECT-SKU",
		quantity: opts.quantity,
		unitPrice: "100.00",
		finalPrice: "300.00",
	});

	return orderId;
}

afterAll(async () => {
	if (!dbAvailable) return;

	// Notifications are inserted fire-and-forget by create(); give them a beat
	// before cleaning up by orderId.
	await new Promise((resolve) => setTimeout(resolve, 250));
	for (const orderId of createdOrderIds) {
		await db
			.delete(adminNotifications)
			.where(sql`${adminNotifications.data}->>'orderId' = ${orderId}`);
	}

	await db.delete(orders).where(inArray(orders.id, createdOrderIds));

	for (const orderId of createdOrderIds) {
		removeOrderAutoCancel(orderId).catch(() => {
			/* best-effort cleanup */
		});
	}

	for (const cartId of createdCartIds) {
		await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
	}
	await db.delete(carts).where(inArray(carts.id, createdCartIds));
	await db.delete(products).where(inArray(products.id, createdProductIds));
	await db.delete(users).where(eq(users.id, userAId));
});

// ── Tests ────────────────────────────────────────────────────────────────

describeDb("OrderService (DB)", () => {
	let firstOrderId: string;

	it("returns the same order when a completed checkout is retried", async () => {
		await addCartItem(cartAId, productAId, 1);

		const first = await OrderService.create({ cartId: cartAId, ...ORDER_CONTEXT }, userAId);
		createdOrderIds.push(first.id);
		firstOrderId = first.id;
		expect(first.status).toBe("pending");

		// Cart is now empty because the order consumed it — the retry must
		// return the same order instead of failing.
		const replay = await OrderService.create({ cartId: cartAId }, userAId);
		expect(replay.id).toBe(first.id);
	});

	it("allows a second purchase with the same cart once it is refilled", async () => {
		await addCartItem(cartAId, productBId, 1);

		const second = await OrderService.create({ cartId: cartAId }, userAId);
		createdOrderIds.push(second.id);

		expect(second.id).not.toBe(firstOrderId);
		expect(second.items.map((item) => item.productId)).toEqual([productBId]);

		// The previous order released the cart link; the new order owns it.
		expect((await fetchOrderRow(firstOrderId)).cartId).toBeNull();
		expect((await fetchOrderRow(second.id)).cartId).toBe(cartAId);
	});

	it("dedupes concurrent double-submits into a single order", async () => {
		await addCartItem(guestCartId, productAId, 1);
		const data = { cartId: guestCartId, guestToken: GUEST_TOKEN, ...ORDER_CONTEXT };

		const [first, second] = await Promise.allSettled([
			OrderService.create(data, null),
			OrderService.create(data, null),
		]);

		expect(first.status).toBe("fulfilled");
		expect(second.status).toBe("fulfilled");

		const firstId = first.status === "fulfilled" ? first.value.id : null;
		const secondId = second.status === "fulfilled" ? second.value.id : null;
		expect(firstId).not.toBeNull();
		expect(secondId).toBe(firstId);
		if (firstId) createdOrderIds.push(firstId);
	});

	it("replays instead of detaching when the cart still holds the order's own generation", async () => {
		const token = `guest-same-gen-${suffix}`;
		const [cart] = await db
			.insert(carts)
			.values({ guestToken: token, itemsCount: 1, lastActivityAt: new Date() })
			.returning({ id: carts.id });
		const cartId = cart!.id;
		createdCartIds.push(cartId);

		// Same generation: the item predates the order that consumed it — the
		// mid-flight snapshot a concurrent retry can observe.
		const itemAt = new Date(Date.now() - 5000);
		await db.insert(cartItems).values({
			cartId,
			productId: productAId,
			quantity: 1,
			addedAtPrice: "0.00",
			createdAt: itemAt,
		});

		orderNumberCounter += 1;
		const [order] = await db
			.insert(orders)
			.values({
				userId: null,
				cartId,
				orderNumber: `TEST-${suffix}-SG-${orderNumberCounter}`,
				status: "pending",
				source: "web",
				customerName: "Same Generation",
				subtotal: "300.00",
				discountTotal: "0.00",
				total: "300.00",
				createdAt: new Date(itemAt.getTime() + 1000),
				updatedAt: new Date(itemAt.getTime() + 1000),
			})
			.returning({ id: orders.id });
		const orderId = order!.id;
		createdOrderIds.push(orderId);

		// The retry must not detach this order (its generation is the cart's
		// current content) and must not create a duplicate — it replays.
		const result = await OrderService.create({ cartId, guestToken: token, ...ORDER_CONTEXT }, null);
		expect(result.id).toBe(orderId);

		const linked = await db.select({ id: orders.id }).from(orders).where(eq(orders.cartId, cartId));
		expect(linked.length).toBe(1);
	});

	it("does not leak admin notes to the owner on cancel", async () => {
		const orderId = await insertPendingOrder({
			userId: userAId,
			productId: productAId,
			quantity: 1,
			adminNotes: "Internal only — must not reach the customer",
		});

		const cancelled = await OrderService.cancelByUser(orderId, userAId);
		expect(cancelled.status).toBe("cancelled");
		expect("adminNotes" in cancelled).toBe(false);
		expect(cancelled.adminNotes).toBeUndefined();
	});

	it("never double-moves stock when two confirms race", async () => {
		for (let i = 0; i < 3; i++) {
			const orderId = await insertPendingOrder({
				userId: userAId,
				productId: productBId,
				quantity: 3,
			});

			const [before] = await db
				.select({ stock: products.stock })
				.from(products)
				.where(eq(products.id, productBId))
				.limit(1);

			const results = await Promise.allSettled([
				OrderService.updateStatus(orderId, { status: "confirmed" }),
				OrderService.updateStatus(orderId, { status: "confirmed" }),
			]);

			// At least one confirm must win; the stock delta must be exactly the
			// ordered quantity regardless of how the race interleaves.
			expect(results.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);

			const [after] = await db
				.select({ stock: products.stock })
				.from(products)
				.where(eq(products.id, productBId))
				.limit(1);

			expect(after!.stock).toBe(before!.stock - 3);
		}
	});
});
