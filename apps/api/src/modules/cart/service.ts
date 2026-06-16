import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { ORDER_RESERVATION_STATUSES } from "@renovabit/db/orders";
import {
	cartItems,
	carts,
	orderItems,
	orders,
	productImages,
	products,
} from "@renovabit/db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getReservedStockSubquery } from "@/utils/stock";
import type { CartItemResponse, CartModel, CartResponse, CartTotalResponse } from "./model";

type AddToCartBody = CartModel["addToCartBody"];
type UpdateCartItemBody = CartModel["updateCartItemBody"];

function now(): Date {
	return new Date();
}

function formatDate(date: Date): string {
	return date.toISOString();
}

function parseNumeric(val: string | number | null | undefined): number {
	if (val === null || val === undefined) return 0;
	if (typeof val === "number") return val;
	return Number.parseFloat(val);
}

// ═══════════════════════════════════════════════════
//  INTERNAL HELPERS
// ═══════════════════════════════════════════════════

async function findCart(userId: string | null, guestToken: string | null) {
	if (userId) {
		const [row] = await db
			.select()
			.from(carts)
			.where(eq(carts.userId, userId))
			.orderBy(desc(carts.lastActivityAt))
			.limit(1);
		return row ?? null;
	}
	if (guestToken) {
		const [row] = await db
			.select()
			.from(carts)
			.where(eq(carts.guestToken, guestToken))
			.orderBy(desc(carts.lastActivityAt))
			.limit(1);
		return row ?? null;
	}
	return null;
}

async function createCart(
	userId: string | null,
): Promise<{ id: string; guestToken: string | null }> {
	const token = userId ? null : nanoid(24);
	const [row] = await db
		.insert(carts)
		.values({
			userId,
			guestToken: token,
			itemsCount: 0,
			lastActivityAt: now(),
		})
		.onConflictDoNothing()
		.returning({ id: carts.id, guestToken: carts.guestToken });

	if (!row) {
		// Concurrent request beat us to it — re-fetch the existing cart
		const existing = await findCart(userId, token);
		if (existing) return { id: existing.id, guestToken: existing.guestToken };

		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al crear el carrito",
		});
	}

	return { id: row.id, guestToken: row.guestToken };
}

async function syncCartSummary(cartId: string): Promise<void> {
	const [row] = await db
		.select({
			itemsCount: sql<number>`COALESCE(SUM(${cartItems.quantity})::int, 0)`,
		})
		.from(cartItems)
		.where(eq(cartItems.cartId, cartId));

	await db
		.update(carts)
		.set({
			itemsCount: row?.itemsCount ?? 0,
			lastActivityAt: now(),
		})
		.where(eq(carts.id, cartId));
}

async function refreshCartItems(cartId: string): Promise<void> {
	const items = await db
		.select({
			itemId: cartItems.id,
			productId: cartItems.productId,
			addedAtPrice: cartItems.addedAtPrice,
			productPrice: products.price,
			productIsActive: products.isActive,
			productNeedsReview: products.needsReview,
			productStock: products.stock,
			reserved: sql<number>`(${getReservedStockSubquery(cartItems.productId)})`,
		})
		.from(cartItems)
		.leftJoin(products, eq(cartItems.productId, products.id))
		.where(eq(cartItems.cartId, cartId));

	const updates = items.map((item) => {
		let status: "available" | "out_of_stock" | "price_changed" | "unavailable";
		let statusMessage: string | null = null;

		if (!item.productPrice) {
			status = "unavailable";
			statusMessage = "Producto no disponible";
		} else if (!item.productIsActive || item.productNeedsReview) {
			status = "unavailable";
			statusMessage = "Producto no disponible";
		} else {
			const availableStock = (item.productStock ?? 0) - (item.reserved ?? 0);
			if (availableStock <= 0) {
				status = "out_of_stock";
				statusMessage = "Producto agotado";
			} else if (item.productPrice !== item.addedAtPrice) {
				status = "price_changed";
				statusMessage = `El precio cambió de S/ ${item.addedAtPrice} a S/ ${item.productPrice}`;
			} else {
				status = "available";
			}
		}

		return db
			.update(cartItems)
			.set({
				status,
				statusMessage,
			})
			.where(eq(cartItems.id, item.itemId));
	});

	await Promise.all(updates);
}

async function getCartWithItems(cartId: string): Promise<CartResponse> {
	const rows = await db
		.select({
			itemId: cartItems.id,
			productId: cartItems.productId,
			productName: products.name,
			productSlug: products.slug,
			productSku: products.sku,
			quantity: cartItems.quantity,
			addedAtPrice: cartItems.addedAtPrice,
			status: cartItems.status,
			statusMessage: cartItems.statusMessage,
			currentPrice: sql<string>`${products.price}::text`,
			imageUrl: sql<string | null>`(
				SELECT pi.url FROM ${productImages} pi
				WHERE pi.product_id = ${products.id}
				ORDER BY pi.is_primary DESC, pi.sort_order ASC NULLS LAST
				LIMIT 1
			)`,
			imageAlt: sql<string | null>`(
				SELECT pi.alt FROM ${productImages} pi
				WHERE pi.product_id = ${products.id}
				ORDER BY pi.is_primary DESC, pi.sort_order ASC NULLS LAST
				LIMIT 1
			)`,
			productIdRef: products.id,
			productNameRef: products.name,
		})
		.from(cartItems)
		.leftJoin(products, eq(cartItems.productId, products.id))
		.where(eq(cartItems.cartId, cartId))
		.orderBy(asc(cartItems.createdAt));

	const items: CartItemResponse[] = rows.map((row) => ({
		id: row.itemId,
		productId: row.productId,
		productName: row.productName ?? "",
		productSlug: row.productSlug ?? "",
		productSku: row.productSku ?? "",
		quantity: row.quantity,
		addedAtPrice: row.addedAtPrice,
		currentPrice: row.currentPrice,
		status: row.status,
		statusMessage: row.statusMessage,
		primaryImage: row.imageUrl ? { url: row.imageUrl, alt: row.imageAlt } : null,
		product: row.productIdRef
			? { id: row.productIdRef, name: row.productNameRef ?? "", slug: row.productSlug ?? "" }
			: null,
	}));

	const itemsCount = items.reduce((sum, i) => sum + i.quantity, 0);

	const [subtotalRow] = await db
		.select({
			subtotal: sql<string>`COALESCE(SUM(${cartItems.addedAtPrice} * ${cartItems.quantity})::text, '0')`,
		})
		.from(cartItems)
		.where(eq(cartItems.cartId, cartId));

	const subtotal = parseNumeric(subtotalRow?.subtotal).toFixed(2);

	const [cart] = await db
		.select({ lastActivityAt: carts.lastActivityAt, guestToken: carts.guestToken })
		.from(carts)
		.where(eq(carts.id, cartId))
		.limit(1);

	const lastActivity = cart?.lastActivityAt ?? new Date();

	return {
		id: cartId,
		guestToken: cart?.guestToken ?? null,
		items,
		itemsCount,
		subtotal,
		lastActivityAt: formatDate(lastActivity),
	};
}

// ═══════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════

async function getOrCreate(
	userId: string | null,
	guestToken: string | null,
): Promise<CartResponse> {
	const existing = await findCart(userId, guestToken);

	if (existing) {
		await refreshCartItems(existing.id);
		return getCartWithItems(existing.id);
	}

	const created = await createCart(userId);
	return getCartWithItems(created.id);
}

async function requireCart(
	userId: string | null,
	guestToken: string | null,
): Promise<CartResponse> {
	const existing = await findCart(userId, guestToken);
	if (!existing) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Carrito no encontrado. Agrega productos primero.",
			logLevel: "info",
			doNotLog: true,
		});
	}
	await refreshCartItems(existing.id);
	return getCartWithItems(existing.id);
}

async function addItem(cartId: string, data: AddToCartBody): Promise<CartResponse> {
	const quantity = data.quantity ?? 1;

	await db.transaction(async (tx) => {
		const [product] = await tx
			.select({
				id: products.id,
				price: products.price,
				stock: products.stock,
				isActive: products.isActive,
				needsReview: products.needsReview,
			})
			.from(products)
			.where(eq(products.id, data.productId))
			.for("update")
			.limit(1);

		if (!product) {
			throw createApiError({
				code: BackendErrorCodes.NOT_FOUND_ERROR,
				message: "Producto no encontrado",
				logLevel: "info",
				doNotLog: true,
			});
		}

		if (!product.isActive || product.needsReview) {
			throw createApiError({
				code: BackendErrorCodes.UNPROCESSABLE_ENTITY,
				message: "Este producto no está disponible actualmente",
				logLevel: "info",
				doNotLog: true,
			});
		}

		const [reserved] = await tx
			.select({ reserved: sql<number>`COALESCE(SUM(${orderItems.quantity})::int, 0)` })
			.from(orderItems)
			.innerJoin(orders, eq(orders.id, orderItems.orderId))
			.where(
				and(
					eq(orderItems.productId, data.productId),
					inArray(orders.status, ORDER_RESERVATION_STATUSES),
				),
			);

		const availableStock = product.stock - (reserved?.reserved ?? 0);

		if (availableStock <= 0) {
			throw createApiError({
				code: BackendErrorCodes.UNPROCESSABLE_ENTITY,
				message: "Este producto está agotado",
				logLevel: "info",
				doNotLog: true,
			});
		}

		const [existingItem] = await tx
			.select({ id: cartItems.id, quantity: cartItems.quantity })
			.from(cartItems)
			.where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, data.productId)))
			.limit(1);

		if (existingItem) {
			const newQty = existingItem.quantity + quantity;
			if (newQty > availableStock) {
				throw createApiError({
					code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
					message: `Solo hay ${availableStock} unidades disponibles de este producto`,
					logLevel: "info",
					doNotLog: true,
				});
			}
			await tx.update(cartItems).set({ quantity: newQty }).where(eq(cartItems.id, existingItem.id));
		} else {
			if (availableStock < quantity) {
				throw createApiError({
					code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
					message: `Solo hay ${availableStock} unidades disponibles de este producto`,
					logLevel: "info",
					doNotLog: true,
				});
			}
			await tx.insert(cartItems).values({
				cartId,
				productId: data.productId,
				quantity,
				addedAtPrice: product.price,
			});
		}
	});

	await syncCartSummary(cartId);

	return getCartWithItems(cartId);
}

async function updateQuantity(
	cartId: string,
	itemId: string,
	data: UpdateCartItemBody,
): Promise<CartResponse> {
	if (data.quantity === 0) {
		const deleted = await db
			.delete(cartItems)
			.where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
			.returning({ id: cartItems.id });

		if (deleted.length === 0) {
			throw createApiError({
				code: BackendErrorCodes.NOT_FOUND_ERROR,
				message: "Item no encontrado en el carrito",
				logLevel: "info",
				doNotLog: true,
			});
		}

		await syncCartSummary(cartId);
		return getCartWithItems(cartId);
	}

	const [item] = await db
		.select({ productId: cartItems.productId })
		.from(cartItems)
		.where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
		.limit(1);

	if (!item) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Item no encontrado en el carrito",
			logLevel: "info",
			doNotLog: true,
		});
	}

	await db.transaction(async (tx) => {
		const [product] = await tx
			.select({ stock: products.stock })
			.from(products)
			.where(eq(products.id, item.productId))
			.for("update")
			.limit(1);

		if (!product) {
			throw createApiError({
				code: BackendErrorCodes.NOT_FOUND_ERROR,
				message: "Producto no encontrado",
				logLevel: "info",
				doNotLog: true,
			});
		}

		const [reserved] = await tx
			.select({ reserved: sql<number>`COALESCE(SUM(${orderItems.quantity})::int, 0)` })
			.from(orderItems)
			.innerJoin(orders, eq(orders.id, orderItems.orderId))
			.where(
				and(
					eq(orderItems.productId, item.productId),
					inArray(orders.status, ORDER_RESERVATION_STATUSES),
				),
			);

		const availableStock = product.stock - (reserved?.reserved ?? 0);

		if (data.quantity > availableStock) {
			throw createApiError({
				code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
				message: `Solo hay ${availableStock} unidades disponibles de este producto`,
				logLevel: "info",
				doNotLog: true,
			});
		}

		await tx
			.update(cartItems)
			.set({ quantity: data.quantity })
			.where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));
	});

	await syncCartSummary(cartId);

	return getCartWithItems(cartId);
}

async function removeItem(cartId: string, itemId: string): Promise<CartResponse> {
	const deleted = await db
		.delete(cartItems)
		.where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
		.returning({ id: cartItems.id });

	if (deleted.length === 0) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Item no encontrado en el carrito",
			logLevel: "info",
			doNotLog: true,
		});
	}

	await syncCartSummary(cartId);

	return getCartWithItems(cartId);
}

async function clearCart(cartId: string): Promise<void> {
	await db.delete(cartItems).where(eq(cartItems.cartId, cartId));

	await db.update(carts).set({ itemsCount: 0, lastActivityAt: now() }).where(eq(carts.id, cartId));
}

async function mergeGuestCart(userId: string, guestToken: string): Promise<CartResponse> {
	const guestCart = await findCart(null, guestToken);
	if (!guestCart) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Carrito de invitado no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	const userCart = await findCart(userId, null);

	const guestItems = await db.select().from(cartItems).where(eq(cartItems.cartId, guestCart.id));

	const existingItems = userCart
		? await db
				.select({ productId: cartItems.productId, quantity: cartItems.quantity })
				.from(cartItems)
				.where(eq(cartItems.cartId, userCart.id))
		: [];
	const existingQtyByProduct = new Map(existingItems.map((i) => [i.productId, i.quantity]));

	const targetCartId = await db.transaction(async (tx) => {
		// ── Stock validation inside transaction with row locks ──
		for (const item of guestItems) {
			const [locked] = await tx
				.select({ id: products.id, stock: products.stock })
				.from(products)
				.where(eq(products.id, item.productId))
				.for("update")
				.limit(1);

			if (!locked) continue; // product deleted — skip (cascade handle)

			const [reserved] = await tx
				.select({ reserved: sql<number>`COALESCE(SUM(${orderItems.quantity})::int, 0)` })
				.from(orderItems)
				.innerJoin(orders, eq(orders.id, orderItems.orderId))
				.where(
					and(
						eq(orderItems.productId, item.productId),
						inArray(orders.status, ORDER_RESERVATION_STATUSES),
					),
				);

			const availableStock = locked.stock - (reserved?.reserved ?? 0);
			const existingQty = existingQtyByProduct.get(item.productId) ?? 0;
			const finalQty = existingQty + item.quantity;

			if (finalQty > availableStock) {
				throw createApiError({
					code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
					message: `Solo hay ${availableStock} unidades disponibles de este producto`,
					logLevel: "info",
					doNotLog: true,
				});
			}
		}
		if (userCart) {
			for (const item of guestItems) {
				const [existing] = await tx
					.select({ id: cartItems.id, quantity: cartItems.quantity })
					.from(cartItems)
					.where(and(eq(cartItems.cartId, userCart.id), eq(cartItems.productId, item.productId)))
					.limit(1);

				if (existing) {
					await tx
						.update(cartItems)
						.set({ quantity: existing.quantity + item.quantity })
						.where(eq(cartItems.id, existing.id));
				} else {
					await tx.insert(cartItems).values({
						cartId: userCart.id,
						productId: item.productId,
						quantity: item.quantity,
						addedAtPrice: item.addedAtPrice,
					});
				}
			}

			await tx.delete(cartItems).where(eq(cartItems.cartId, guestCart.id));
			await tx.delete(carts).where(eq(carts.id, guestCart.id));

			return userCart.id;
		}

		await tx.update(carts).set({ userId, guestToken: null }).where(eq(carts.id, guestCart.id));
		return guestCart.id;
	});

	await syncCartSummary(targetCartId);
	await refreshCartItems(targetCartId);
	return getCartWithItems(targetCartId);
}

async function getTotal(cartId: string): Promise<CartTotalResponse> {
	const [row] = await db
		.select({
			itemsCount: sql<number>`COALESCE(SUM(${cartItems.quantity})::int, 0)`,
			subtotal: sql<string>`COALESCE(SUM(${cartItems.addedAtPrice} * ${cartItems.quantity})::text, '0')`,
		})
		.from(cartItems)
		.where(eq(cartItems.cartId, cartId));

	const subtotal = parseNumeric(row?.subtotal).toFixed(2);

	return {
		itemsCount: row?.itemsCount ?? 0,
		subtotal,
	};
}

async function getTotalByOwner(
	userId: string | null,
	guestToken: string | null,
): Promise<CartTotalResponse> {
	if (userId) {
		const cart = await getOrCreate(userId, null);
		return getTotal(cart.id);
	}

	if (!guestToken) {
		return { itemsCount: 0, subtotal: "0.00" };
	}

	const cart = await findCart(null, guestToken);
	if (!cart) {
		return { itemsCount: 0, subtotal: "0.00" };
	}

	await refreshCartItems(cart.id);
	return getTotal(cart.id);
}

// ═══════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════

export const CartService = {
	getOrCreate,
	requireCart,
	addItem,
	updateQuantity,
	removeItem,
	clearCart,
	merge: mergeGuestCart,
	getTotal,
	getTotalByOwner,
};
