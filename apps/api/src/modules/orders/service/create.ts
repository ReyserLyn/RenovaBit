import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { AUTO_CANCEL_MS } from "@renovabit/db/constants";
import { cartItems, carts, orderItems, orders, products, users } from "@renovabit/db/schema";
import {
	applyOfferToProduct,
	type CartItemInput,
	calculateOrderTotal,
	getEffectiveSalePrice,
	type Role,
} from "@renovabit/pricing";
import { type Static } from "@sinclair/typebox";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { MAX_ORDER_NUMBER_RETRIES, MAX_PENDING_ORDERS } from "@/constants";
import { enqueueOrderAutoCancel } from "@/jobs/orders.queue";
import { notifyAdminsOfOrder } from "@/modules/notifications/notifications.service";
import { OfferService } from "@/modules/offers/service";
import { isUniqueViolationOn } from "@/utils/db-helpers";
import { logger } from "@/utils/logger";
import { getActiveMarginRules } from "@/utils/margin-rules";
import { getReservedStockForProductInTx } from "@/utils/stock";
import type { OrderResponse } from "../model";
import { OrderModel } from "../model";
import { buildOrderResponse, getById } from "./queries";

type CreateBody = Static<typeof OrderModel.createBody>;

const ORDER_SUFFIX = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 10);

function generateOrderNumber(): string {
	const year = new Date().getFullYear();
	return `ORD-${year}-${ORDER_SUFFIX()}`;
}

// ═══════════════════════════════════════════════════
//  CREATE ORDER
// ═══════════════════════════════════════════════════

async function create(data: CreateBody, userId: string | null): Promise<OrderResponse> {
	const [cartRow] = await db
		.select({ id: carts.id, userId: carts.userId, guestToken: carts.guestToken })
		.from(carts)
		.where(eq(carts.id, data.cartId))
		.limit(1);

	if (!cartRow) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Carrito no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	if (userId) {
		if (cartRow.userId && cartRow.userId !== userId) {
			throw createApiError({
				code: BackendErrorCodes.ACCESS_DENIED,
				message: "Este carrito no pertenece al usuario actual",
				logLevel: "info",
				doNotLog: true,
			});
		}

		if (!cartRow.userId) {
			if (!data.guestToken || cartRow.guestToken !== data.guestToken) {
				throw createApiError({
					code: BackendErrorCodes.ACCESS_DENIED,
					message: "Este carrito no pertenece al usuario actual",
					logLevel: "info",
					doNotLog: true,
				});
			}
		}
	} else {
		if (!data.guestToken || cartRow.guestToken !== data.guestToken) {
			throw createApiError({
				code: BackendErrorCodes.ACCESS_DENIED,
				message: "Este carrito no pertenece al token proporcionado",
				logLevel: "info",
				doNotLog: true,
			});
		}
	}

	const cartItemsList = await db
		.select({
			itemId: cartItems.id,
			productId: cartItems.productId,
			quantity: cartItems.quantity,
			addedAtPrice: cartItems.addedAtPrice,
			createdAt: cartItems.createdAt,
		})
		.from(cartItems)
		.where(eq(cartItems.cartId, data.cartId));

	// ── Idempotent replay / empty-cart guard ──
	// An order already linked to this cart means a previous checkout consumed
	// it. While the cart is still empty this request is a retry of that
	// checkout, so we return the same order. A refilled cart is a NEW purchase:
	// the stale link is detached inside the transaction below.
	if (cartItemsList.length === 0) {
		const [existingOrder] = await db
			.select({ id: orders.id })
			.from(orders)
			.where(eq(orders.cartId, data.cartId))
			.limit(1);

		if (existingOrder) {
			const order = await getById(existingOrder.id);
			if (order) return order;
		}

		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "El carrito está vacío",
			logLevel: "info",
			doNotLog: true,
		});
	}

	// Oldest item in the cart: the detach below only releases orders created
	// BEFORE this instant, i.e. orders whose generation is fully superseded by
	// the current cart contents. A concurrent retry shares this cart
	// generation (its items predate the winner's order) and therefore never
	// detaches the winner.
	const oldestItemCreatedAt = cartItemsList.reduce(
		(oldest, item) => (item.createdAt < oldest ? item.createdAt : oldest),
		cartItemsList[0]!.createdAt,
	);

	// Cap pending orders per user (abuse prevention). Checked after the replay
	// path so retries of a just-created order never hit the cap.
	if (userId) {
		const [countRow] = await db
			.select({ pending: sql<number>`count(*)::int` })
			.from(orders)
			.where(and(eq(orders.userId, userId), eq(orders.status, "pending")));
		if ((countRow?.pending ?? 0) >= MAX_PENDING_ORDERS) {
			throw createApiError({
				code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
				message: `Tienes demasiados pedidos pendientes (máximo ${MAX_PENDING_ORDERS}). Espera a que sean procesados.`,
				logLevel: "info",
				doNotLog: true,
			});
		}
	}

	const productIds = cartItemsList.map((i) => i.productId);
	const productRows = await db
		.select({
			id: products.id,
			name: products.name,
			slug: products.slug,
			sku: products.sku,
			supplierPrice: products.supplierPrice,
			roleCustomMargins: products.roleCustomMargins,
			stock: products.stock,
			isActive: products.isActive,
			needsReview: products.needsReview,
		})
		.from(products)
		.where(inArray(products.id, productIds));

	const productMap = new Map(productRows.map((p) => [p.id, p]));

	// Resolve the buyer's role for role-aware pricing (admin always sees raw).
	let orderRole: Role = "customer";
	if (userId) {
		const [u] = await db
			.select({ role: users.role })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		const r = u?.role;
		if (r === "admin" || r === "customer") {
			orderRole = r;
		}
	}

	const marginRules = await getActiveMarginRules();

	for (const item of cartItemsList) {
		const product = productMap.get(item.productId);
		if (!product) {
			throw createApiError({
				code: BackendErrorCodes.UNPROCESSABLE_ENTITY,
				message: "Uno o más productos ya no existen",
				logLevel: "info",
				doNotLog: true,
			});
		}
		if (!product.isActive || product.needsReview) {
			throw createApiError({
				code: BackendErrorCodes.UNPROCESSABLE_ENTITY,
				message: `"${product.name}" ya no está disponible`,
				logLevel: "info",
				doNotLog: true,
			});
		}
	}
	// NOTE: stock re-validation moved INSIDE transaction below

	// Resolve active offers for each product (so we can apply them to the order total).
	// Fetched outside the transaction: a race with offer expiry mid-checkout is acceptable
	// since the order is still `pending` and the discount is snapshotted at creation time.
	const activeOffersByProduct = await OfferService.getActiveOffersForProducts(
		orderRole,
		productIds,
	);

	// Resolve a product's role-aware unit price once and reuse for both pricing
	// summary and per-line final price computation.
	const resolveUnitPrice = (item: (typeof cartItemsList)[number]) => {
		const product = productMap.get(item.productId);
		return getEffectiveSalePrice(
			{
				supplierPrice: product?.supplierPrice ?? "0",
				roleCustomMargins: product?.roleCustomMargins ?? null,
			},
			orderRole,
			marginRules,
		).salePrice;
	};

	// Pre-compute per-line pricing so the transaction body only persists it.
	// Use the buyer's role (or 'customer' for guests) for role-aware pricing.
	const pricingItems: CartItemInput[] = cartItemsList.map((item) => ({
		salePrice: resolveUnitPrice(item),
		quantity: item.quantity,
		offers: activeOffersByProduct.get(item.productId) ?? [],
	}));
	const pricingResult = calculateOrderTotal({ items: pricingItems }, orderRole);

	const discountTotalValue = pricingResult.offerDiscount;
	const discountTotalStr = discountTotalValue.toFixed(2);
	const total = pricingResult.total.toFixed(2);

	// Per-line finalPrice after applying offers; precomputed for the transaction body.
	const lineFinalPrices = new Map<string, string>();
	for (const item of cartItemsList) {
		const salePrice = resolveUnitPrice(item);
		const offer = activeOffersByProduct.get(item.productId);
		if (offer && offer.length > 0) {
			const discounted = applyOfferToProduct(salePrice, offer, orderRole).discountedPrice;
			lineFinalPrices.set(item.itemId, (discounted * item.quantity).toFixed(2));
		} else {
			lineFinalPrices.set(item.itemId, (salePrice * item.quantity).toFixed(2));
		}
	}

	const now = new Date();
	let customerName =
		typeof data.customerName === "string" ? data.customerName.trim() || null : null;
	let customerPhone =
		typeof data.customerPhone === "string" ? data.customerPhone.trim() || null : null;

	if (userId && (!customerName || !customerPhone)) {
		const [profile] = await db
			.select({ name: users.name, phone: users.phone })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		if (profile) {
			if (!customerName) customerName = profile.name;
			if (!customerPhone) customerPhone = profile.phone ?? null;
		}
	}

	const normalizedNotes = typeof data.notes === "string" ? data.notes.trim() || null : null;

	const appliedOfferIds = data.appliedOfferIds ?? [];
	if (appliedOfferIds.length > 0) {
		const validOfferIds = new Set<string>();
		for (const offers of activeOffersByProduct.values()) {
			for (const offer of offers) {
				if (offer.id) validOfferIds.add(offer.id);
			}
		}
		const invalid = appliedOfferIds.filter((id) => !validOfferIds.has(id));
		if (invalid.length > 0) {
			throw createApiError({
				code: BackendErrorCodes.UNPROCESSABLE_ENTITY,
				message: `Ofertas no válidas o expiradas: ${invalid.join(", ")}`,
				logLevel: "info",
				doNotLog: true,
			});
		}
	}

	const runCreateTransaction = () =>
		db.transaction(async (tx) => {
			// ── Stock re-validation inside transaction with FOR UPDATE ──
			const uniqueProductIds = [...new Set(cartItemsList.map((i) => i.productId))].sort();
			for (const productId of uniqueProductIds) {
				const [locked] = await tx
					.select({ id: products.id, stock: products.stock })
					.from(products)
					.where(eq(products.id, productId))
					.for("update")
					.limit(1);

				if (!locked) {
					throw createApiError({
						code: BackendErrorCodes.UNPROCESSABLE_ENTITY,
						message: "Uno o más productos ya no existen",
						logLevel: "info",
						doNotLog: true,
					});
				}

				const reserved = await getReservedStockForProductInTx(tx, productId);
				const availableStock = locked.stock - reserved;
				const required = cartItemsList
					.filter((i) => i.productId === productId)
					.reduce((sum, i) => sum + i.quantity, 0);

				if (availableStock < required) {
					const product = productMap.get(productId);
					const name = product?.name ?? "Producto";
					throw createApiError({
						code: BackendErrorCodes.UNPROCESSABLE_ENTITY,
						message: `Stock insuficiente para "${name}". Disponible: ${availableStock}`,
						logLevel: "info",
						doNotLog: true,
					});
				}
			}

			// A refilled cart is a new purchase: release the previous order's link
			// so the unique constraint admits this order. Only orders older than
			// the whole current cart are released — a concurrent retry shares this
			// cart generation, so its insert still hits the unique constraint and
			// the winner's order is returned to the caller outside this transaction.
			await tx
				.update(orders)
				.set({ cartId: null })
				.where(and(eq(orders.cartId, data.cartId), lt(orders.createdAt, oldestItemCreatedAt)));

			let order:
				| {
						id: string;
						userId: string | null;
						orderNumber: string;
						status: "pending" | "confirmed" | "cancelled" | "refunded";
						source: "web" | "whatsapp";
						paymentMethod: "cash" | "transfer" | "yape" | "plin" | null;
						subtotal: string;
						discountTotal: string;
						total: string;
						notes: string | null;
						customerName: string | null;
						customerPhone: string | null;
						createdAt: Date;
				  }
				| undefined;

			for (let attempt = 0; attempt < MAX_ORDER_NUMBER_RETRIES; attempt++) {
				const orderNumber = generateOrderNumber();
				try {
					const metadataValue = {
						...(appliedOfferIds.length > 0 ? { applied_offer_ids: appliedOfferIds } : {}),
					};

					const [created] = await tx
						.insert(orders)
						.values({
							userId: userId ?? null,
							cartId: data.cartId,
							orderNumber,
							source: "web",
							paymentMethod: data.paymentMethod,
							customerName,
							customerPhone,
							subtotal: "0",
							discountTotal: "0",
							total: "0",
							notes: normalizedNotes,
							metadata: metadataValue,
							createdAt: now,
							updatedAt: now,
						})
						.returning({
							id: orders.id,
							userId: orders.userId,
							orderNumber: orders.orderNumber,
							status: orders.status,
							source: orders.source,
							paymentMethod: orders.paymentMethod,
							subtotal: orders.subtotal,
							discountTotal: orders.discountTotal,
							total: orders.total,
							notes: orders.notes,
							customerName: orders.customerName,
							customerPhone: orders.customerPhone,
							createdAt: orders.createdAt,
						});

					order = created;
					break;
				} catch (err) {
					if (isUniqueViolationOn(err, "orders_cart_id_unique")) {
						// A concurrent checkout won the race. Rethrown so the caller
						// can return the winner's order after this transaction rolls
						// back.
						throw err;
					}
					if (
						!isUniqueViolationOn(err, "orders_order_number_unique") ||
						attempt === MAX_ORDER_NUMBER_RETRIES - 1
					)
						throw err;
				}
			}

			if (!order) {
				throw createApiError({
					code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
					message: "Error al crear el pedido",
				});
			}

			const computedSubtotal = pricingResult.subtotal.toFixed(2);

			// Batch insert all order items in a single statement
			const orderItemsValues = cartItemsList.map((item) => {
				const product = productMap.get(item.productId);
				const lineFinalPrice = lineFinalPrices.get(item.itemId) ?? "0.00";

				// Recompute the role-aware unit price at order creation time.
				// The cart's `addedAtPrice` may be stale or based on a different role.
				const rolePrice = resolveUnitPrice(item);
				return {
					orderId: order.id,
					productId: item.productId,
					productName: product?.name ?? "",
					productSku: product?.sku ?? "",
					quantity: item.quantity,
					unitPrice: rolePrice.toFixed(2),
					finalPrice: lineFinalPrice,
				};
			});

			const insertedItems = await tx
				.insert(orderItems)
				.values(orderItemsValues)
				.returning({ id: orderItems.id });

			// Zip insertedItems with cartItemsList by position. If lengths diverge
			// the DB returned something we didn't insert — bail out explicitly
			// rather than indexing with a force-assert.
			if (insertedItems.length !== cartItemsList.length) {
				throw createApiError({
					code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
					message: "Error al crear el pedido: inconsistencia en la respuesta del DB",
				});
			}

			const createdItems = insertedItems.map((inserted, index) => {
				const item = cartItemsList[index];
				const product = item ? productMap.get(item.productId) : undefined;
				if (!item || !product) {
					throw createApiError({
						code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
						message: "Error al crear el pedido: inconsistencia en la respuesta del DB",
					});
				}
				const rolePrice = resolveUnitPrice(item);
				return {
					id: inserted.id,
					productId: item.productId,
					productName: product.name,
					productSku: product.sku,
					productSlug: product.slug,
					quantity: item.quantity,
					unitPrice: rolePrice.toFixed(2),
					finalPrice: lineFinalPrices.get(item.itemId) ?? "0.00",
				};
			});

			await tx
				.update(orders)
				.set({ subtotal: computedSubtotal, discountTotal: discountTotalStr, total })
				.where(eq(orders.id, order.id));
			const deletedCartItems = await tx
				.delete(cartItems)
				.where(eq(cartItems.cartId, data.cartId))
				.returning({ id: cartItems.id });

			if (deletedCartItems.length !== cartItemsList.length) {
				throw createApiError({
					code: BackendErrorCodes.UNPROCESSABLE_ENTITY,
					message: "El carrito cambió mientras procesábamos tu pedido. Intenta nuevamente",
					logLevel: "info",
					doNotLog: true,
				});
			}

			await tx
				.update(carts)
				.set({ itemsCount: 0, lastActivityAt: now })
				.where(eq(carts.id, data.cartId));

			order.subtotal = computedSubtotal;
			order.discountTotal = discountTotalStr;
			order.total = total;

			return { order, items: createdItems };
		});

	let orderResult: Awaited<ReturnType<typeof runCreateTransaction>>;
	try {
		orderResult = await runCreateTransaction();
	} catch (err) {
		if (isUniqueViolationOn(err, "orders_cart_id_unique")) {
			// Two checkouts for the same cart raced: return the winner's order
			// (idempotent replay for the loser).
			const [existingOrder] = await db
				.select({ id: orders.id })
				.from(orders)
				.where(eq(orders.cartId, data.cartId))
				.limit(1);
			if (existingOrder) {
				const order = await getById(existingOrder.id);
				if (order) return order;
			}
		}
		throw err;
	}

	notifyAdminsOfOrder({
		orderId: orderResult.order.id,
		orderNumber: orderResult.order.orderNumber,
		total: orderResult.order.total,
		customerName,
	}).catch((err) => logger.withMetadata({ err }).error("[Order] Notification error"));

	enqueueOrderAutoCancel(orderResult.order.id, AUTO_CANCEL_MS).catch((err) =>
		logger
			.withMetadata({ err, orderId: orderResult.order.id })
			.warn("[Order] auto-cancel schedule failed"),
	);

	// Re-fetch using SSOT response builder
	const [finalOrder] = await db
		.select()
		.from(orders)
		.where(eq(orders.id, orderResult.order.id))
		.limit(1);

	if (!finalOrder) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al recuperar el pedido creado",
		});
	}

	return buildOrderResponse(finalOrder);
}

export { create };
