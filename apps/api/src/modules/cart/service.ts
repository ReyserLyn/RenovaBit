import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { cartItems, carts, productImages, products } from "@renovabit/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
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
		.returning({ id: carts.id, guestToken: carts.guestToken });

	if (!row) {
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
			addedAtPrice: cartItems.addedAtPrice,
			productPrice: products.price,
			productStock: products.stock,
			productIsActive: products.isActive,
			productNeedsReview: products.needsReview,
		})
		.from(cartItems)
		.leftJoin(products, eq(cartItems.productId, products.id))
		.where(eq(cartItems.cartId, cartId));

	for (const item of items) {
		let status: "available" | "out_of_stock" | "price_changed" | "unavailable";
		let statusMessage: string | null = null;

		if (!item.productPrice) {
			status = "unavailable";
			statusMessage = "Producto no disponible";
		} else if (!item.productIsActive || item.productNeedsReview) {
			status = "unavailable";
			statusMessage = "Producto no disponible";
		} else if ((item.productStock ?? 0) <= 0) {
			status = "out_of_stock";
			statusMessage = "Producto agotado";
		} else if (item.productPrice !== item.addedAtPrice) {
			status = "price_changed";
			statusMessage = `El precio cambió de S/ ${item.addedAtPrice} a S/ ${item.productPrice}`;
		} else {
			status = "available";
		}

		await db
			.update(cartItems)
			.set({
				status,
				statusMessage,
			})
			.where(eq(cartItems.id, item.itemId));
	}
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
	const subtotal = items
		.reduce((sum, i) => sum + parseNumeric(i.addedAtPrice) * i.quantity, 0)
		.toFixed(2);

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
	const [product] = await db
		.select({
			id: products.id,
			price: products.price,
			stock: products.stock,
			isActive: products.isActive,
			needsReview: products.needsReview,
		})
		.from(products)
		.where(eq(products.id, data.productId))
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

	if (product.stock <= 0) {
		throw createApiError({
			code: BackendErrorCodes.UNPROCESSABLE_ENTITY,
			message: "Este producto está agotado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	const quantity = data.quantity ?? 1;

	const [existingItem] = await db
		.select({ id: cartItems.id, quantity: cartItems.quantity })
		.from(cartItems)
		.where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, data.productId)))
		.limit(1);

	if (existingItem) {
		const newQty = existingItem.quantity + quantity;
		if (newQty > product.stock) {
			throw createApiError({
				code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
				message: `Solo hay ${product.stock} unidades disponibles de este producto`,
				logLevel: "info",
				doNotLog: true,
			});
		}
		await db.update(cartItems).set({ quantity: newQty }).where(eq(cartItems.id, existingItem.id));
	} else {
		if (product.stock < quantity) {
			throw createApiError({
				code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
				message: `Solo hay ${product.stock} unidades disponibles de este producto`,
				logLevel: "info",
				doNotLog: true,
			});
		}
		await db.insert(cartItems).values({
			cartId,
			productId: data.productId,
			quantity,
			addedAtPrice: product.price,
		});
	}

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

	const [product] = await db
		.select({ stock: products.stock })
		.from(products)
		.where(eq(products.id, item.productId))
		.limit(1);

	if (product && data.quantity > product.stock) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: `Solo hay ${product.stock} unidades disponibles de este producto`,
			logLevel: "info",
			doNotLog: true,
		});
	}

	await db
		.update(cartItems)
		.set({ quantity: data.quantity })
		.where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));

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

	const targetCartId = await db.transaction(async (tx) => {
		const guestItems = await tx.select().from(cartItems).where(eq(cartItems.cartId, guestCart.id));

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
