import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import {
	cartItems,
	carts,
	productImages,
	products,
	type RoleCustomMargins,
} from "@renovabit/db/schema";
import { applyOfferToProduct, getEffectiveSalePrice, type Role } from "@renovabit/pricing";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { OfferService } from "@/modules/offers/service";
import { formatDate, now } from "@/utils/date";
import { getActiveMarginRules } from "@/utils/margin-rules";
import { getReservedStockForProductInTx, getReservedStockSubquery } from "@/utils/stock";
import type { CartItemResponse, CartModel, CartResponse, CartTotalResponse } from "./model";

type AddToCartBody = CartModel["addToCartBody"];
type UpdateCartItemBody = CartModel["updateCartItemBody"];

// ═══════════════════════════════════════════════════
//  PRICING HELPERS
// ═══════════════════════════════════════════════════

/**
 * Compute the effective sale price for a product given the user's role.
 * Accepts pre-fetched margin rules to avoid re-fetching per item.
 */
function getRoleAwarePrice(
	supplierPrice: string,
	roleCustomMargins: RoleCustomMargins | null | undefined,
	role: Role,
	marginRules: ReadonlyArray<{
		minPrice: string;
		maxPrice: string | null;
		customerPct: string;
		distributorPct: string;
	}>,
): number {
	const { salePrice } = getEffectiveSalePrice(
		{ supplierPrice, roleCustomMargins: roleCustomMargins ?? null },
		role,
		marginRules,
	);
	return salePrice;
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

async function refreshCartItems(cartId: string, role: Role): Promise<void> {
	const marginRules = await getActiveMarginRules();

	const items = await db
		.select({
			itemId: cartItems.id,
			productId: cartItems.productId,
			addedAtPrice: cartItems.addedAtPrice,
			productPrice: products.price,
			supplierPrice: products.supplierPrice,
			roleCustomMargins: products.roleCustomMargins,
			productIsActive: products.isActive,
			productNeedsReview: products.needsReview,
			productStock: products.stock,
			reserved: sql<number>`(${getReservedStockSubquery(cartItems.productId)})`,
		})
		.from(cartItems)
		.leftJoin(products, eq(cartItems.productId, products.id))
		.where(eq(cartItems.cartId, cartId));

	// Fetch active offers for ALL products in this cart at once
	const productIds = items.map((i) => i.productId);
	const activeOffersByProduct = await OfferService.getActiveOffersForProducts(role, productIds);

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
			} else {
				// Compute current role-aware price (without offer)
				const roleAwarePrice = getRoleAwarePrice(
					item.supplierPrice ?? "0",
					item.roleCustomMargins,
					role,
					marginRules,
				);

				// Compute current offer-applied price (F16)
				const offers = activeOffersByProduct.get(item.productId) ?? [];
				const offerResult = applyOfferToProduct(roleAwarePrice, offers, role);
				const currentOfferPriceStr = offerResult.discountedPrice.toFixed(2);

				// Compare with stored addedAtPrice (F11: detect offer expiry / change)
				if (currentOfferPriceStr !== item.addedAtPrice) {
					status = "price_changed";
					statusMessage = `El precio cambió de S/ ${item.addedAtPrice} a S/ ${currentOfferPriceStr}`;
				} else {
					status = "available";
				}
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

async function getCartWithItems(cartId: string, role: Role): Promise<CartResponse> {
	const marginRules = await getActiveMarginRules();

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
			supplierPrice: products.supplierPrice,
			roleCustomMargins: products.roleCustomMargins,
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

	// Fetch active offers for all products to compute offer-applied prices
	const productIds = rows.map((r) => r.productId);
	const activeOffersByProduct = await OfferService.getActiveOffersForProducts(role, productIds);

	let subtotal = 0;
	const items: CartItemResponse[] = rows.map((row) => {
		const roleAwarePrice = row.supplierPrice
			? getRoleAwarePrice(row.supplierPrice, row.roleCustomMargins, role, marginRules)
			: 0;
		const roleAwarePriceStr = roleAwarePrice.toFixed(2);

		// Compute offer-applied price (F16). Subtotal uses the offer price
		// so the cart total matches what the user will actually pay.
		const offers = activeOffersByProduct.get(row.productId) ?? [];
		const offerResult = applyOfferToProduct(roleAwarePrice, offers, role);
		const currentOfferPriceStr = offerResult.discountedPrice.toFixed(2);
		subtotal += offerResult.discountedPrice * row.quantity;

		const priceChanged = row.status === "price_changed";

		// Build applied-offer metadata for the line response (customer-only)
		const appliedOffers: Array<{
			id: string;
			discountValue: number;
		}> = [];
		let savedAmount = 0;
		if (role === "customer" && offers.length > 0) {
			for (const o of offers) {
				if (o.id) {
					appliedOffers.push({
						id: o.id,
						discountValue: o.discountValue,
					});
				}
			}
			savedAmount = Math.round((roleAwarePrice - offerResult.discountedPrice) * 100) / 100;
		}

		return {
			id: row.itemId,
			productId: row.productId,
			productName: row.productName ?? "",
			productSlug: row.productSlug ?? "",
			productSku: row.productSku ?? "",
			quantity: row.quantity,
			addedAtPrice: row.addedAtPrice,
			currentRolePrice: roleAwarePriceStr,
			currentOfferPrice: currentOfferPriceStr,
			priceChanged,
			appliedOffers,
			savedAmount,
			status: row.status,
			statusMessage: row.statusMessage,
			primaryImage: row.imageUrl ? { url: row.imageUrl, alt: row.imageAlt } : null,
			product: row.productIdRef
				? { id: row.productIdRef, name: row.productNameRef ?? "", slug: row.productSlug ?? "" }
				: null,
		};
	});

	const itemsCount = items.reduce((sum, i) => sum + i.quantity, 0);

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
		subtotal: subtotal.toFixed(2),
		lastActivityAt: formatDate(lastActivity),
	};
}

// ═══════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════

async function getOrCreate(
	userId: string | null,
	guestToken: string | null,
	role: Role,
): Promise<CartResponse> {
	const existing = await findCart(userId, guestToken);

	if (existing) {
		await refreshCartItems(existing.id, role);
		return getCartWithItems(existing.id, role);
	}

	const created = await createCart(userId);
	return getCartWithItems(created.id, role);
}

async function requireCart(
	userId: string | null,
	guestToken: string | null,
	role: Role,
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
	await refreshCartItems(existing.id, role);
	return getCartWithItems(existing.id, role);
}

async function addItem(cartId: string, data: AddToCartBody, role: Role): Promise<CartResponse> {
	const quantity = data.quantity ?? 1;

	const marginRules = await getActiveMarginRules();

	// Fetch product outside the transaction just to compute the offer-applied price
	const [productInfo] = await db
		.select({
			id: products.id,
			price: products.price,
			supplierPrice: products.supplierPrice,
			roleCustomMargins: products.roleCustomMargins,
		})
		.from(products)
		.where(eq(products.id, data.productId))
		.limit(1);

	if (!productInfo) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Producto no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	// Compute role-aware price + offer-applied price AT ADD TIME
	const roleAwarePrice = getRoleAwarePrice(
		productInfo.supplierPrice,
		productInfo.roleCustomMargins,
		role,
		marginRules,
	);
	const activeOffers = await OfferService.getActiveOffersForProducts(role, [data.productId]);
	const offerResult = applyOfferToProduct(
		roleAwarePrice,
		activeOffers.get(data.productId) ?? [],
		role,
	);

	// Store the FULL offer-applied price as the snapshot (F11+F16: includes offers)
	const addedAtPrice = offerResult.discountedPrice.toFixed(2);

	await db.transaction(async (tx) => {
		const [product] = await tx
			.select({
				id: products.id,
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

		const reserved = await getReservedStockForProductInTx(tx, data.productId);
		const availableStock = product.stock - reserved;

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
			// Update the addedAtPrice since the offer price may have changed
			// between the first add and now.
			await tx
				.update(cartItems)
				.set({ quantity: newQty, addedAtPrice })
				.where(eq(cartItems.id, existingItem.id));
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
				addedAtPrice,
			});
		}
	});

	await syncCartSummary(cartId);

	return getCartWithItems(cartId, role);
}

async function updateQuantity(
	cartId: string,
	itemId: string,
	data: UpdateCartItemBody,
	role: Role,
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
		return getCartWithItems(cartId, role);
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

		const reserved = await getReservedStockForProductInTx(tx, item.productId);
		const availableStock = product.stock - reserved;

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

	return getCartWithItems(cartId, role);
}

async function removeItem(cartId: string, itemId: string, role: Role): Promise<CartResponse> {
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

	return getCartWithItems(cartId, role);
}

async function clearCart(cartId: string): Promise<void> {
	await db.delete(cartItems).where(eq(cartItems.cartId, cartId));

	await db.update(carts).set({ itemsCount: 0, lastActivityAt: now() }).where(eq(carts.id, cartId));
}

async function mergeGuestCart(
	userId: string,
	guestToken: string,
	role: Role,
): Promise<CartResponse> {
	const guestCart = await findCart(null, guestToken);
	if (!guestCart) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Carrito de invitado no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	const guestItems = await db.select().from(cartItems).where(eq(cartItems.cartId, guestCart.id));

	const targetCartId = await db.transaction(async (tx) => {
		// ── Lock the guest cart row first to prevent concurrent merges of
		// the same guest cart. Re-read inside the transaction (the hint above
		// is informational only). ──
		const [guestCartLocked] = await tx
			.select({ id: carts.id })
			.from(carts)
			.where(eq(carts.id, guestCart.id))
			.for("update")
			.limit(1);
		if (!guestCartLocked) {
			throw createApiError({
				code: BackendErrorCodes.NOT_FOUND_ERROR,
				message: "Carrito de invitado no encontrado",
				logLevel: "info",
				doNotLog: true,
			});
		}

		// Re-resolve the user cart inside the transaction and lock it to
		// serialize concurrent merges of multiple guest carts into the same user.
		const [userCartLocked] = await tx
			.select({ id: carts.id })
			.from(carts)
			.where(and(eq(carts.userId, userId)))
			.orderBy(desc(carts.lastActivityAt))
			.limit(1)
			.for("update");
		const userCart = userCartLocked ?? null;

		// ── Re-fetch user-cart items INSIDE the transaction so the stock
		// check uses the current user cart state. Otherwise, a concurrent add
		// to the user cart between the outer read and this transaction can be
		// missed and we'd merge over the available stock.
		const existingQtyByProduct = new Map<string, number>();
		if (userCart) {
			const existingItems = await tx
				.select({ productId: cartItems.productId, quantity: cartItems.quantity })
				.from(cartItems)
				.where(eq(cartItems.cartId, userCart.id));
			for (const i of existingItems) {
				existingQtyByProduct.set(i.productId, i.quantity);
			}
		}

		// ── Stock validation inside transaction with row locks ──
		for (const item of guestItems) {
			const [locked] = await tx
				.select({ id: products.id, stock: products.stock })
				.from(products)
				.where(eq(products.id, item.productId))
				.for("update")
				.limit(1);

			if (!locked) continue; // product deleted — skip (cascade handle)

			const reserved = await getReservedStockForProductInTx(tx, item.productId);
			const availableStock = locked.stock - reserved;
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
	await refreshCartItems(targetCartId, role);
	return getCartWithItems(targetCartId, role);
}

async function getTotal(cartId: string, role: Role): Promise<CartTotalResponse> {
	const marginRules = await getActiveMarginRules();

	const rows = await db
		.select({
			quantity: cartItems.quantity,
			supplierPrice: products.supplierPrice,
			roleCustomMargins: products.roleCustomMargins,
		})
		.from(cartItems)
		.leftJoin(products, eq(cartItems.productId, products.id))
		.where(eq(cartItems.cartId, cartId));

	let subtotal = 0;
	let itemsCount = 0;
	for (const row of rows) {
		itemsCount += row.quantity;
		const roleAwarePrice = row.supplierPrice
			? getRoleAwarePrice(row.supplierPrice, row.roleCustomMargins, role, marginRules)
			: 0;
		subtotal += roleAwarePrice * row.quantity;
	}

	return {
		itemsCount,
		subtotal: subtotal.toFixed(2),
	};
}

async function getTotalByOwner(
	userId: string | null,
	guestToken: string | null,
	role: Role,
): Promise<CartTotalResponse> {
	if (userId) {
		const cart = await getOrCreate(userId, null, role);
		return getTotal(cart.id, role);
	}

	if (!guestToken) {
		return { itemsCount: 0, subtotal: "0.00" };
	}

	const cart = await findCart(null, guestToken);
	if (!cart) {
		return { itemsCount: 0, subtotal: "0.00" };
	}

	await refreshCartItems(cart.id, role);
	return getTotal(cart.id, role);
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
