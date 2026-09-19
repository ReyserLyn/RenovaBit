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
import { CONFIRMED_HOLD_HOURS, MAX_PENDING_GUEST_ORDERS } from "@/constants";
import { removeOrderAutoCancel } from "@/jobs/orders.queue";
import { REVIEW_REASONS } from "@/utils/review-reasons";
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
const ORDER_CONTEXT = {
	customerName: "Test Buyer",
	customerPhone: "999888777",
	paymentMethod: "cash" as const,
};

/**
 * Unique guest phone per call. The guest pending cap counts pending orders by
 * phone DB-wide, so sharing one test phone would leak state across tests (and
 * across interrupted runs).
 */
let guestPhoneCounter = 0;
function guestContext() {
	guestPhoneCounter += 1;
	return {
		...ORDER_CONTEXT,
		customerPhone: `9${String(Date.now() + guestPhoneCounter).slice(-8)}`,
	};
}

let userAId: string;
let productAId: string;
let productBId: string;
let productCId: string;
let productDId: string;
let productEId: string;
let productFId: string;
let productGId: string;
let productHId: string;
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

	// Products C and D: isolated fixtures for the stock-hold tests.
	const [productC] = await db
		.insert(products)
		.values({
			name: `OrderTest Charlie ${suffix}`,
			slug: `ordertest-charlie-${suffix}`,
			sku: `ORDERTEST-C-${suffix}`,
			price: "200.00",
			supplierPrice: "100.00",
			stock: 10,
		})
		.returning({ id: products.id });
	productCId = productC!.id;

	const [productD] = await db
		.insert(products)
		.values({
			name: `OrderTest Delta ${suffix}`,
			slug: `ordertest-delta-${suffix}`,
			sku: `ORDERTEST-D-${suffix}`,
			price: "200.00",
			supplierPrice: "100.00",
			stock: 10,
		})
		.returning({ id: products.id });
	productDId = productD!.id;

	// Product E: owner-managed fixture (no feed) for manual stock behavior.
	const [productE] = await db
		.insert(products)
		.values({
			name: `OrderTest Echo ${suffix}`,
			slug: `ordertest-echo-${suffix}`,
			sku: `ORDERTEST-E-${suffix}`,
			price: "500.00",
			supplierPrice: "0",
			stock: 5,
			managedBy: "manual",
		})
		.returning({ id: products.id });
	productEId = productE!.id;

	// Product F: advisory-only reason ("Sin imagen") — checkout must accept it.
	const [productF] = await db
		.insert(products)
		.values({
			name: `OrderTest Foxtrot ${suffix}`,
			slug: `ordertest-foxtrot-${suffix}`,
			sku: `ORDERTEST-F-${suffix}`,
			price: "200.00",
			supplierPrice: "100.00",
			stock: 10,
			needsReview: true,
			reviewReason: REVIEW_REASONS.missingImage,
		})
		.returning({ id: products.id });
	productFId = productF!.id;

	// Product G: blocking reason — checkout must reject it.
	const [productG] = await db
		.insert(products)
		.values({
			name: `OrderTest Golf ${suffix}`,
			slug: `ordertest-golf-${suffix}`,
			sku: `ORDERTEST-G-${suffix}`,
			price: "200.00",
			supplierPrice: "100.00",
			stock: 10,
			needsReview: true,
			reviewReason: REVIEW_REASONS.invalidPrice,
		})
		.returning({ id: products.id });
	productGId = productG!.id;

	// Product H: flag set without a reason — nothing actionable, so purchasable.
	const [productH] = await db
		.insert(products)
		.values({
			name: `OrderTest Hotel ${suffix}`,
			slug: `ordertest-hotel-${suffix}`,
			sku: `ORDERTEST-H-${suffix}`,
			price: "200.00",
			supplierPrice: "100.00",
			stock: 10,
			needsReview: true,
			reviewReason: null,
		})
		.returning({ id: products.id });
	productHId = productH!.id;

	createdProductIds.push(
		productAId,
		productBId,
		productCId,
		productDId,
		productEId,
		productFId,
		productGId,
		productHId,
	);

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

/** Fresh guest cart with its own token (tracks it for cleanup). */
async function createGuestCart(label: string): Promise<{ cartId: string; token: string }> {
	const token = `guest-${label}-${suffix}`;
	const [cart] = await db
		.insert(carts)
		.values({ guestToken: token, itemsCount: 0, lastActivityAt: new Date() })
		.returning({ id: carts.id });
	const id = cart!.id;
	createdCartIds.push(id);
	return { cartId: id, token };
}

async function fetchOrderRow(orderId: string): Promise<{ cartId: string | null; status: string }> {
	const [row] = await db
		.select({ cartId: orders.cartId, status: orders.status })
		.from(orders)
		.where(eq(orders.id, orderId))
		.limit(1);
	return row!;
}

/** Inserts an order directly (no checkout side effects). */
async function insertPendingOrder(opts: {
	userId: string;
	productId: string;
	quantity: number;
	adminNotes?: string;
	status?: "pending" | "confirmed" | "cancelled" | "refunded";
	createdAt?: Date;
	confirmedAt?: Date;
}): Promise<string> {
	orderNumberCounter += 1;
	const now = opts.createdAt ?? new Date();
	const [order] = await db
		.insert(orders)
		.values({
			userId: opts.userId,
			orderNumber: `TEST-${suffix}-${orderNumberCounter}`,
			status: opts.status ?? "pending",
			source: "web",
			customerName: "Direct Insert",
			subtotal: "300.00",
			discountTotal: "0.00",
			total: "300.00",
			adminNotes: opts.adminNotes ?? null,
			confirmedAt: opts.confirmedAt ?? null,
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

/** Inserts a pending guest order directly (no checkout side effects). */
async function insertPendingGuestOrder(phone: string): Promise<string> {
	orderNumberCounter += 1;
	const now = new Date();
	const [order] = await db
		.insert(orders)
		.values({
			userId: null,
			orderNumber: `TEST-${suffix}-G-${orderNumberCounter}`,
			status: "pending",
			source: "web",
			customerName: "Guest Flood",
			customerPhone: phone,
			subtotal: "300.00",
			discountTotal: "0.00",
			total: "300.00",
			createdAt: now,
			updatedAt: now,
		})
		.returning({ id: orders.id });
	const orderId = order!.id;
	createdOrderIds.push(orderId);
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
		const replay = await OrderService.create({ cartId: cartAId, paymentMethod: "cash" }, userAId);
		expect(replay.id).toBe(first.id);
	});

	it("allows a second purchase with the same cart once it is refilled", async () => {
		await addCartItem(cartAId, productBId, 1);

		const second = await OrderService.create(
			{ cartId: cartAId, paymentMethod: "transfer" },
			userAId,
		);
		createdOrderIds.push(second.id);

		expect(second.id).not.toBe(firstOrderId);
		expect(second.items.map((item) => item.productId)).toEqual([productBId]);

		// The previous order released the cart link; the new order owns it.
		expect((await fetchOrderRow(firstOrderId)).cartId).toBeNull();
		expect((await fetchOrderRow(second.id)).cartId).toBe(cartAId);
	});

	it("dedupes concurrent double-submits into a single order", async () => {
		await addCartItem(guestCartId, productAId, 1);
		const data = { cartId: guestCartId, guestToken: GUEST_TOKEN, ...guestContext() };

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
		const result = await OrderService.create(
			{ cartId, guestToken: token, ...guestContext() },
			null,
		);
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

	it("treats admin date filters as Lima days, not UTC days", async () => {
		const day = "2026-09-17";
		// Lima-day orders: a morning one and the evening block that a
		// UTC-midnight `to` boundary would wrongly exclude.
		const morning = await insertPendingOrder({
			userId: userAId,
			productId: productAId,
			quantity: 1,
			createdAt: new Date("2026-09-17T10:00:00-05:00"),
		});
		const evening = await insertPendingOrder({
			userId: userAId,
			productId: productAId,
			quantity: 1,
			createdAt: new Date("2026-09-17T23:30:00-05:00"),
		});
		// Neighbouring Lima days must stay outside the window.
		const before = await insertPendingOrder({
			userId: userAId,
			productId: productAId,
			quantity: 1,
			createdAt: new Date("2026-09-16T23:30:00-05:00"),
		});
		const after = await insertPendingOrder({
			userId: userAId,
			productId: productAId,
			quantity: 1,
			createdAt: new Date("2026-09-18T00:30:00-05:00"),
		});

		const { orders: results } = await OrderService.listAdmin({
			from: day,
			to: day,
			search: suffix,
			limit: 100,
		});

		const ids = results.map((o) => o.id);
		expect(ids).toContain(morning);
		expect(ids).toContain(evening);
		expect(ids).not.toContain(before);
		expect(ids).not.toContain(after);
	});

	it("sorts admin lists by status business priority", async () => {
		const cancelled = await insertPendingOrder({
			userId: userAId,
			productId: productAId,
			quantity: 1,
			status: "cancelled",
		});
		const confirmed = await insertPendingOrder({
			userId: userAId,
			productId: productAId,
			quantity: 1,
			status: "confirmed",
		});
		const pending = await insertPendingOrder({
			userId: userAId,
			productId: productAId,
			quantity: 1,
			status: "pending",
		});

		const { orders: results } = await OrderService.listAdmin({
			sortBy: "status",
			sortOrder: "asc",
			search: suffix,
			limit: 100,
		});

		const relevant = results
			.map((o) => o.id)
			.filter((id) => [pending, confirmed, cancelled].includes(id));
		expect(relevant).toEqual([pending, confirmed, cancelled]);
	});

	it("concurrent confirms converge to one transition and never write stock", async () => {
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

			// At least one confirm must win.
			expect(results.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);

			const [after] = await db
				.select({ stock: products.stock })
				.from(products)
				.where(eq(products.id, productBId))
				.limit(1);

			// The provider feed owns stock: confirming is a pure transition.
			expect(after!.stock).toBe(before!.stock);
		}
	});

	it("a recently confirmed order keeps holding stock during the grace window", async () => {
		await insertPendingOrder({
			userId: userAId,
			productId: productCId,
			quantity: 3,
			status: "confirmed",
			confirmedAt: new Date(),
		});

		const { cartId, token } = await createGuestCart("hold-active");
		await addCartItem(cartId, productCId, 8);

		// Available = 10 - 3 (active hold) = 7 → an 8-unit checkout is rejected.
		await expect(
			OrderService.create({ cartId, guestToken: token, ...guestContext() }, null),
		).rejects.toThrow(/Disponible: 7/);
	});

	it("releases the hold once the grace window has passed", async () => {
		const pastGrace = new Date(Date.now() - (CONFIRMED_HOLD_HOURS + 1) * 60 * 60 * 1000);
		await insertPendingOrder({
			userId: userAId,
			productId: productDId,
			quantity: 3,
			status: "confirmed",
			confirmedAt: pastGrace,
		});

		const { cartId, token } = await createGuestCart("hold-expired");
		await addCartItem(cartId, productDId, 10);

		// Available = the full 10: the expired confirmation no longer holds, so
		// the full-stock checkout goes through.
		const order = await OrderService.create({ cartId, guestToken: token, ...guestContext() }, null);
		createdOrderIds.push(order.id);
		expect(order.status).toBe("pending");
	});

	it("moves stock with order state for owner-managed products", async () => {
		const orderId = await insertPendingOrder({
			userId: userAId,
			productId: productEId,
			quantity: 2,
		});

		// productE starts at stock 5 (owner-managed, no feed).
		await OrderService.updateStatus(orderId, { status: "confirmed" });
		const [afterConfirm] = await db
			.select({ stock: products.stock })
			.from(products)
			.where(eq(products.id, productEId))
			.limit(1);
		expect(afterConfirm!.stock).toBe(3); // 5 - 2

		await OrderService.updateStatus(orderId, { status: "cancelled" });
		const [afterCancel] = await db
			.select({ stock: products.stock })
			.from(products)
			.where(eq(products.id, productEId))
			.limit(1);
		expect(afterCancel!.stock).toBe(5); // restored
	});

	it("holds stock for pending orders on owner-managed products", async () => {
		await insertPendingOrder({
			userId: userAId,
			productId: productEId,
			quantity: 3,
		});

		// stock 5, pending hold 3 → available 2 → a 3-unit checkout is rejected.
		const { cartId, token } = await createGuestCart("manual-hold");
		await addCartItem(cartId, productEId, 3);
		await expect(
			OrderService.create({ cartId, guestToken: token, ...guestContext() }, null),
		).rejects.toThrow(/Disponible: 2/);
	});

	it("checks out an advisory-only product (Sin imagen) and leaves its review data intact", async () => {
		const { cartId, token } = await createGuestCart("advisory-review");
		await addCartItem(cartId, productFId, 1);

		const order = await OrderService.create({ cartId, guestToken: token, ...guestContext() }, null);
		createdOrderIds.push(order.id);

		expect(order.status).toBe("pending");
		expect(order.items.map((item) => item.productId)).toEqual([productFId]);

		// The advisory flag stays for the operator: checkout never rewrites it.
		const [row] = await db
			.select({ needsReview: products.needsReview, reviewReason: products.reviewReason })
			.from(products)
			.where(eq(products.id, productFId))
			.limit(1);
		expect(row?.needsReview).toBe(true);
		expect(row?.reviewReason).toBe(REVIEW_REASONS.missingImage);
	});

	it("checks out a product flagged for review with no reason", async () => {
		const { cartId, token } = await createGuestCart("flag-no-reason");
		await addCartItem(cartId, productHId, 1);

		const order = await OrderService.create({ cartId, guestToken: token, ...guestContext() }, null);
		createdOrderIds.push(order.id);

		expect(order.items.map((item) => item.productId)).toEqual([productHId]);
	});

	it("rejects checkout for a product with a blocking review reason", async () => {
		const { cartId, token } = await createGuestCart("blocking-review");
		await addCartItem(cartId, productGId, 1);

		await expect(
			OrderService.create({ cartId, guestToken: token, ...guestContext() }, null),
		).rejects.toThrow(/ya no está disponible/);

		// The rejected checkout persisted no order and left the cart untouched.
		const linked = await db.select({ id: orders.id }).from(orders).where(eq(orders.cartId, cartId));
		expect(linked.length).toBe(0);
		const items = await db
			.select({ id: cartItems.id })
			.from(cartItems)
			.where(eq(cartItems.cartId, cartId));
		expect(items.length).toBe(1);
	});

	it("normalizes the customer name and phone before persisting", async () => {
		const { cartId, token } = await createGuestCart("phone-normalize");
		await addCartItem(cartId, productAId, 1);

		const order = await OrderService.create(
			{
				cartId,
				guestToken: token,
				customerName: "  Phone Test  ",
				customerPhone: "+51 999 111 222",
				paymentMethod: "cash",
			},
			null,
		);
		createdOrderIds.push(order.id);

		expect(order.customerName).toBe("Phone Test");
		// Country code collapsed: "+51 999 111 222" → "999111222".
		expect(order.customerPhone).toBe("999111222");
	});

	it("rejects an unparseable phone and a too-short name", async () => {
		const { cartId, token } = await createGuestCart("invalid-contact");
		await addCartItem(cartId, productAId, 1);

		await expect(
			OrderService.create(
				{
					cartId,
					guestToken: token,
					customerName: "Valid Name",
					customerPhone: "abcdef",
					paymentMethod: "cash",
				},
				null,
			),
		).rejects.toThrow(/teléfono no es válido/);

		await expect(
			OrderService.create(
				{
					cartId,
					guestToken: token,
					customerName: " A ",
					customerPhone: "999111333",
					paymentMethod: "cash",
				},
				null,
			),
		).rejects.toThrow(/al menos 2 caracteres/);
	});

	it("caps pending orders per guest phone", async () => {
		const phone = `9${String(Date.now()).slice(-8)}`;
		for (let i = 0; i < MAX_PENDING_GUEST_ORDERS; i++) {
			await insertPendingGuestOrder(phone);
		}

		const { cartId, token } = await createGuestCart("guest-flood-cap");
		await addCartItem(cartId, productAId, 1);

		await expect(
			OrderService.create(
				{
					cartId,
					guestToken: token,
					customerName: "Guest Flood",
					customerPhone: `+51 ${phone}`,
					paymentMethod: "cash",
				},
				null,
			),
		).rejects.toThrow(/demasiados pedidos pendientes/);
	});
});
