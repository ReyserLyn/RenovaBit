import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { AUTO_CANCEL_MS } from "@renovabit/db/constants";
import {
	ORDER_STATUS_TRANSITIONS,
	type OrderSource,
	type OrderStatus,
	type PaymentMethod,
} from "@renovabit/db/orders";
import { ORDER_STATUS_LABELS } from "@renovabit/db/orders-meta";
import { cartItems, carts, orderItems, orders, products, users } from "@renovabit/db/schema";
import {
	applyOfferToProduct,
	type CartItemInput,
	calculateOrderTotal,
	getEffectiveSalePrice,
	type Role,
} from "@renovabit/pricing";
import { type Static } from "@sinclair/typebox";
import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, lte, or, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import {
	DEFAULT_PAGE_SIZE,
	MAX_ATTACHMENTS,
	MAX_ORDER_NUMBER_RETRIES,
	MAX_PAGE_SIZE,
	MAX_PENDING_ORDERS,
} from "@/constants";
import { enqueueOrderAutoCancel, removeOrderAutoCancel } from "@/jobs/orders.queue";
import {
	notifyAdminsOfCancelledOrder,
	notifyAdminsOfOrder,
} from "@/modules/notifications/notifications.service";
import { OfferService } from "@/modules/offers/service";
import { formatDate } from "@/utils/date";
import { isUniqueViolationOn } from "@/utils/db-helpers";
import { logger } from "@/utils/logger";
import { getActiveMarginRules, getActiveRoleMarginRules } from "@/utils/margin-rules";
import { getReservedStockForProductInTx } from "@/utils/stock";
import {
	deleteEntityAttachment,
	extractKeyFromUrl,
	getPublicUrl,
	isPendingUrl,
	moveObject,
} from "@/utils/storage/helpers";
import type { OrderListItem, OrderResponse } from "./model";
import { OrderModel } from "./model";

type CreateBody = Static<typeof OrderModel.createBody>;
type AdminUpdateBody = Static<typeof OrderModel.adminUpdateBody>;

const ORDER_SUFFIX = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 10);

const AUTO_CANCEL_REASON = "Cancelado automáticamente por falta de confirmación";

function generateOrderNumber(): string {
	const year = new Date().getFullYear();
	return `ORD-${year}-${ORDER_SUFFIX()}`;
}

function sanitizePagination(
	page: string | number | undefined = 0,
	limit: string | number | undefined = DEFAULT_PAGE_SIZE,
) {
	const parseNumber = (value: string | number | undefined, fallback: number): number => {
		if (value === undefined) return fallback;
		if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) ? parsed : fallback;
	};

	const parsedPage = parseNumber(page, 0);
	const parsedLimit = parseNumber(limit, DEFAULT_PAGE_SIZE);

	const safePage = parsedPage >= 0 ? Math.trunc(parsedPage) : 0;
	const requestedLimit = parsedLimit > 0 ? Math.trunc(parsedLimit) : DEFAULT_PAGE_SIZE;
	const safeLimit = Math.min(requestedLimit, MAX_PAGE_SIZE);
	return { safePage, safeLimit, offset: safePage * safeLimit };
}

function parseJsonArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}

type OrderRow = typeof orders.$inferSelect;

async function buildOrderResponse(order: OrderRow, isAdminView = false): Promise<OrderResponse> {
	const items = await db
		.select({
			id: orderItems.id,
			productId: orderItems.productId,
			productName: orderItems.productName,
			productSku: orderItems.productSku,
			quantity: orderItems.quantity,
			unitPrice: orderItems.unitPrice,
			finalPrice: orderItems.finalPrice,
			createdAt: orderItems.createdAt,
			productSlug: products.slug,
		})
		.from(orderItems)
		.leftJoin(products, eq(orderItems.productId, products.id))
		.where(eq(orderItems.orderId, order.id))
		.orderBy(asc(orderItems.createdAt));

	let customerName = order.customerName ?? null;
	let customerEmail: string | null = null;
	if (order.userId) {
		const [userRow] = await db
			.select({ name: users.name, email: users.email })
			.from(users)
			.where(eq(users.id, order.userId))
			.limit(1);
		if (userRow) {
			customerEmail = userRow.email ?? null;
			if (!customerName) customerName = userRow.name;
		}
	}

	return {
		id: order.id,
		userId: order.userId ?? null,
		orderNumber: order.orderNumber,
		status: order.status,
		source: order.source,
		paymentMethod: order.paymentMethod ?? null,
		customerName,
		customerPhone: order.customerPhone ?? null,
		customerEmail,
		subtotal: order.subtotal,
		discountTotal: order.discountTotal,
		total: order.total,
		notes: order.notes ?? null,
		items: items.map((i) => ({
			id: i.id,
			productId: i.productId ?? null,
			productName: i.productName,
			productSku: i.productSku,
			productSlug: i.productSlug ?? null,
			quantity: i.quantity,
			unitPrice: i.unitPrice,
			finalPrice: i.finalPrice,
		})),
		createdAt: formatDate(order.createdAt),
		confirmedAt: order.confirmedAt ? formatDate(order.confirmedAt) : null,
		cancelledAt: order.cancelledAt ? formatDate(order.cancelledAt) : null,
		cancelReason: order.cancelReason ?? null,
		attachments: parseJsonArray(order.attachments),
		...(isAdminView ? { adminNotes: order.adminNotes ?? null } : {}),
	};
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

	// Cap pending orders per user (abuse prevention)
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

	const cartItemsList = await db
		.select({
			itemId: cartItems.id,
			productId: cartItems.productId,
			quantity: cartItems.quantity,
			addedAtPrice: cartItems.addedAtPrice,
		})
		.from(cartItems)
		.where(eq(cartItems.cartId, data.cartId));

	if (cartItemsList.length === 0) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "El carrito está vacío",
			logLevel: "info",
			doNotLog: true,
		});
	}

	// ── Idempotency: return existing order for this cart ──
	{
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
		if (r === "admin" || r === "distributor" || r === "customer") {
			orderRole = r;
		}
	}

	const [customerRules, roleRules] = await Promise.all([
		getActiveMarginRules(),
		getActiveRoleMarginRules(),
	]);

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
	const activeOffersByProduct = await OfferService.getActiveOffersForProducts(productIds);

	// Pre-compute per-line pricing so the transaction body only persists it.
	// Use the buyer's role (or 'customer' for guests) for role-aware pricing.
	const pricingItems: CartItemInput[] = cartItemsList.map((item) => {
		const product = productMap.get(item.productId);
		const { salePrice } = getEffectiveSalePrice(
			{
				supplierPrice: product?.supplierPrice ?? "0",
				roleCustomMargins: product?.roleCustomMargins ?? null,
			},
			orderRole,
			customerRules,
			roleRules,
		);
		return {
			salePrice,
			quantity: item.quantity,
			offers: activeOffersByProduct.get(item.productId) ?? [],
		};
	});
	const pricingResult = calculateOrderTotal({ items: pricingItems });

	const discountTotalValue = pricingResult.offerDiscount;
	const discountTotalStr = discountTotalValue.toFixed(2);
	const total = pricingResult.total.toFixed(2);

	// Per-line finalPrice after applying offers; precomputed for the transaction body.
	const lineFinalPrices = new Map<string, string>();
	for (const item of cartItemsList) {
		const product = productMap.get(item.productId);
		const { salePrice } = getEffectiveSalePrice(
			{
				supplierPrice: product?.supplierPrice ?? "0",
				roleCustomMargins: product?.roleCustomMargins ?? null,
			},
			orderRole,
			customerRules,
			roleRules,
		);
		const offer = activeOffersByProduct.get(item.productId);
		if (offer && offer.length > 0) {
			const discounted = applyOfferToProduct(salePrice, offer).discountedPrice;
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

	const orderResult = await db.transaction(async (tx) => {
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
					throw createApiError({
						code: BackendErrorCodes.CONFLICT,
						message: "Ya existe un pedido para este carrito",
						logLevel: "info",
						doNotLog: true,
					});
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
			const product = productMap.get(item.productId)!;
			const lineFinalPrice = lineFinalPrices.get(item.itemId) ?? "0.00";

			// Recompute the role-aware unit price at order creation time.
			// The cart's `addedAtPrice` may be stale or based on a different role.
			const { salePrice: rolePrice } = getEffectiveSalePrice(
				{
					supplierPrice: product.supplierPrice,
					roleCustomMargins: product.roleCustomMargins,
				},
				orderRole,
				customerRules,
				roleRules,
			);
			return {
				orderId: order.id,
				productId: item.productId,
				productName: product.name,
				productSku: product.sku,
				quantity: item.quantity,
				unitPrice: rolePrice.toFixed(2),
				finalPrice: lineFinalPrice,
			};
		});

		const insertedItems = await tx
			.insert(orderItems)
			.values(orderItemsValues)
			.returning({ id: orderItems.id });

		const createdItems = insertedItems.map((inserted, index) => {
			const item = cartItemsList[index]!;
			const product = productMap.get(item.productId)!;
			const { salePrice: rolePrice } = getEffectiveSalePrice(
				{
					supplierPrice: product.supplierPrice,
					roleCustomMargins: product.roleCustomMargins,
				},
				orderRole,
				customerRules,
				roleRules,
			);
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

// ═══════════════════════════════════════════════════
//  GET ORDER
// ═══════════════════════════════════════════════════

async function getById(orderId: string, isAdminView = false): Promise<OrderResponse | null> {
	const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

	if (!order) return null;

	// Lazy auto-cancel: si está pending y venció, lo cancelamos antes de devolver.
	// El `where status=pending` en el UPDATE lo hace idempotente: si el worker
	// ya canceló (o el safety-net corrió), el UPDATE no aplica filas y el re-fetch
	// siguiente simplemente lee el estado actual canónico.
	if (order.status === "pending" && Date.now() - order.createdAt.getTime() >= AUTO_CANCEL_MS) {
		const now = new Date();
		const updated = await db
			.update(orders)
			.set({
				status: "cancelled",
				cancelledAt: now,
				cancelReason: AUTO_CANCEL_REASON,
				updatedAt: now,
			})
			.where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
			.returning({ id: orders.id });

		if (updated.length > 0) {
			// Cancelamos el job delayed de auto-cancel para no desperdiciar lecturas en Redis.
			removeOrderAutoCancel(orderId).catch((err) =>
				logger
					.withMetadata({ orderId })
					.withError(err)
					.warn("[Orders] failed to remove auto-cancel job (lazy)"),
			);
		}

		const [refreshed] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
		if (!refreshed) return null;
		return buildOrderResponse(refreshed, isAdminView);
	}

	return buildOrderResponse(order, isAdminView);
}

// ═══════════════════════════════════════════════════
//  LIST ORDERS (SHARED)
// ═══════════════════════════════════════════════════

async function queryOrderList(
	where: SQL | undefined,
	page: string | number | undefined,
	limit: string | number | undefined,
	context: string,
	sortBy: "createdAt" | "total" | "orderNumber" | "status" | "customerName" = "createdAt",
	sortOrder: "asc" | "desc" = "desc",
): Promise<{ orders: OrderListItem[]; total: number }> {
	const { safeLimit, offset } = sanitizePagination(page, limit);

	const [countRow] = await db
		.select({ total: count(orders.id) })
		.from(orders)
		.where(where);

	const total = Number(countRow?.total ?? 0);

	const sortColumnMap = {
		createdAt: orders.createdAt,
		total: orders.total,
		orderNumber: orders.orderNumber,
		status: orders.status,
		customerName: orders.customerName,
	} as const;

	const orderBy =
		sortBy === "total"
			? sortOrder === "asc"
				? sql`${orders.total}::numeric asc`
				: sql`${orders.total}::numeric desc`
			: sortOrder === "asc"
				? asc(sortColumnMap[sortBy])
				: desc(sortColumnMap[sortBy]);

	const rows = await db
		.select({
			id: orders.id,
			orderNumber: orders.orderNumber,
			status: orders.status,
			source: orders.source,
			total: orders.total,
			customerName: sql<string | null>`COALESCE(${orders.customerName}, ${users.name})`,
			createdAt: orders.createdAt,
		})
		.from(orders)
		.leftJoin(users, eq(orders.userId, users.id))
		.where(where)
		.orderBy(orderBy)
		.offset(offset)
		.limit(safeLimit);

	const orderIds = rows.map((r) => r.id);
	const itemsCounts: Record<string, number> = {};

	if (orderIds.length > 0) {
		const counts = await db
			.select({
				orderId: orderItems.orderId,
				qty: sql<number>`sum(${orderItems.quantity})::int`,
			})
			.from(orderItems)
			.where(inArray(orderItems.orderId, orderIds))
			.groupBy(orderItems.orderId);

		for (const c of counts) {
			itemsCounts[c.orderId] = c.qty;
		}
	}

	const ordersList: OrderListItem[] = rows.map((row) => ({
		id: row.id,
		orderNumber: row.orderNumber,
		status: row.status,
		source: row.source,
		total: row.total,
		itemsCount: itemsCounts[row.id] ?? 0,
		customerName: row.customerName ?? null,
		createdAt: formatDate(row.createdAt),
	}));

	return { orders: ordersList, total };
}

// ═══════════════════════════════════════════════════
//  LIST ORDERS (USER)
// ═══════════════════════════════════════════════════

async function listByUser(
	userId: string,
	page: string | number | undefined,
	limit: string | number | undefined,
	status?: OrderStatus,
): Promise<{ orders: OrderListItem[]; total: number }> {
	const conditions = [eq(orders.userId, userId)];
	if (status) {
		conditions.push(eq(orders.status, status));
	}
	const where = conditions.length > 0 ? and(...conditions) : undefined;

	return queryOrderList(where, page, limit, "listByUser");
}

// ═══════════════════════════════════════════════════
//  LIST ORDERS (ADMIN)
// ═══════════════════════════════════════════════════

async function listAdmin(
	options: {
		status?: OrderStatus;
		source?: OrderSource;
		paymentMethod?: PaymentMethod;
		from?: string;
		to?: string;
		page?: string | number | undefined;
		limit?: string | number | undefined;
		search?: string | undefined;
		sortBy?: "createdAt" | "total" | "orderNumber" | "status" | "customerName";
		sortOrder?: "asc" | "desc";
	} = {},
): Promise<{ orders: OrderListItem[]; total: number }> {
	const conditions = [];
	if (options.status) {
		conditions.push(eq(orders.status, options.status));
	}
	if (options.source) {
		conditions.push(eq(orders.source, options.source));
	}
	if (options.paymentMethod) {
		conditions.push(eq(orders.paymentMethod, options.paymentMethod));
	}
	if (options.from) {
		const fromDate = new Date(options.from);
		if (!Number.isNaN(fromDate.getTime())) {
			conditions.push(gte(orders.createdAt, fromDate));
		}
	}
	if (options.to) {
		const toDate = new Date(options.to);
		if (!Number.isNaN(toDate.getTime())) {
			if (
				toDate.getUTCHours() === 0 &&
				toDate.getUTCMinutes() === 0 &&
				toDate.getUTCSeconds() === 0
			) {
				toDate.setHours(23, 59, 59, 999);
			}
			conditions.push(lte(orders.createdAt, toDate));
		}
	}
	if (options.search) {
		const term = `%${options.search}%`;
		conditions.push(or(ilike(orders.orderNumber, term), ilike(orders.customerName, term)));
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	return queryOrderList(
		where,
		options.page,
		options.limit,
		"listAdmin",
		options.sortBy,
		options.sortOrder,
	);
}

// ═══════════════════════════════════════════════════
//  UPDATE ORDER STATUS (ADMIN)
// ═══════════════════════════════════════════════════

async function updateStatus(orderId: string, data: AdminUpdateBody): Promise<OrderResponse> {
	const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

	if (!order) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Pedido no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	const isStatusChanging = data.status !== order.status;

	if (isStatusChanging) {
		const allowed = ORDER_STATUS_TRANSITIONS[order.status] ?? [];
		if (!allowed.includes(data.status)) {
			throw createApiError({
				code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
				message: `No se puede cambiar el estado de "${order.status}" a "${data.status}"`,
				logLevel: "info",
				doNotLog: true,
			});
		}
	}

	const now = new Date();
	const updates: Partial<typeof orders.$inferInsert> = {
		updatedAt: now,
	};

	if (isStatusChanging) {
		updates.status = data.status;
		if (data.status === "confirmed") {
			updates.confirmedAt = now;
		}
		if (data.status === "cancelled") {
			updates.cancelledAt = now;
			updates.cancelReason = data.cancelReason ?? null;
		}

		const dateStr = new Intl.DateTimeFormat("es-PE", {
			timeZone: "America/Lima",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		}).format(now);
		const systemNote = `[${dateStr}] Sistema: Pedido ${(ORDER_STATUS_LABELS[data.status] ?? data.status).toLowerCase()}`;
		const existingNotes = order.adminNotes ?? "";
		const adminProvidedNotes = data.adminNotes !== undefined ? data.adminNotes : "";
		const combinedNotes = [adminProvidedNotes, existingNotes, systemNote]
			.filter(Boolean)
			.join("\n");
		updates.adminNotes = combinedNotes || systemNote;
	}
	if (data.adminNotes !== undefined && !isStatusChanging) {
		updates.adminNotes = data.adminNotes;
	}

	if (isStatusChanging) {
		const orderItemsList = await db
			.select({
				productId: orderItems.productId,
				quantity: orderItems.quantity,
				productName: orderItems.productName,
			})
			.from(orderItems)
			.where(eq(orderItems.orderId, orderId));

		await db.transaction(async (tx) => {
			if (data.status === "confirmed") {
				for (const item of orderItemsList) {
					if (!item.productId) continue;
					const updatedStock = await tx
						.update(products)
						.set({ stock: sql`${products.stock} - ${item.quantity}` })
						.where(and(eq(products.id, item.productId), gte(products.stock, item.quantity)))
						.returning({ id: products.id });

					if (updatedStock.length === 0) {
						throw createApiError({
							code: BackendErrorCodes.UNPROCESSABLE_ENTITY,
							message: `Stock insuficiente para "${item.productName}" al confirmar pedido`,
							logLevel: "info",
							doNotLog: true,
						});
					}
				}
			} else if (
				(data.status === "cancelled" || data.status === "refunded") &&
				order.status === "confirmed"
			) {
				for (const item of orderItemsList) {
					if (!item.productId) continue;
					await tx
						.update(products)
						.set({ stock: sql`${products.stock} + ${item.quantity}` })
						.where(eq(products.id, item.productId));
				}
			}

			await tx.update(orders).set(updates).where(eq(orders.id, orderId));
		});
	} else {
		await db.update(orders).set(updates).where(eq(orders.id, orderId));
	}

	if (isStatusChanging && order.status === "pending") {
		removeOrderAutoCancel(orderId).catch((err) =>
			logger
				.withMetadata({ orderId })
				.withError(err)
				.warn("[Orders] failed to remove auto-cancel job"),
		);
	}

	const updated = await getById(orderId);
	if (!updated) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al actualizar el pedido",
		});
	}

	return updated;
}

// ═══════════════════════════════════════════════════
//  USER CANCEL
// ═══════════════════════════════════════════════════

const USER_CANCEL_REASON = "Cancelado por el cliente";

async function cancelByUser(orderId: string, userId: string): Promise<OrderResponse> {
	const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

	if (!order) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Pedido no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	if (order.userId !== userId) {
		throw createApiError({
			code: BackendErrorCodes.ACCESS_DENIED,
			message: "Este pedido no te pertenece",
			logLevel: "info",
			doNotLog: true,
		});
	}

	if (order.status !== "pending") {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "Solo puedes cancelar pedidos pendientes",
			logLevel: "info",
			doNotLog: true,
		});
	}

	if (Date.now() - order.createdAt.getTime() >= AUTO_CANCEL_MS) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "El pedido ya no puede cancelarse porque superó el plazo de 2 días",
			logLevel: "info",
			doNotLog: true,
		});
	}

	const now = new Date();
	const [updated] = await db
		.update(orders)
		.set({
			status: "cancelled",
			cancelledAt: now,
			cancelReason: USER_CANCEL_REASON,
			updatedAt: now,
		})
		.where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
		.returning({ id: orders.id });

	if (!updated) {
		// Already cancelled (admin or auto-cancel) between read and write.
		// Return current state truthfully instead of pretending user cancelled it.
		const current = await getById(orderId);
		if (current) return current;
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al cancelar el pedido",
		});
	}

	removeOrderAutoCancel(orderId).catch((err) =>
		logger
			.withMetadata({ orderId })
			.withError(err)
			.warn("[Orders] failed to remove auto-cancel job"),
	);

	const refreshed = await getById(orderId, true);
	if (!refreshed) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al cancelar el pedido",
		});
	}

	return refreshed;
}

// ═══════════════════════════════════════════════════
//  AUTO-CANCEL
// ═══════════════════════════════════════════════════

/**
 * Cancela automáticamente los pedidos en `pending` con más de
 * {@link AUTO_CANCEL_MS} de antigüedad. Idempotente: seguro de llamar
 * en cada read (lazy) o desde el job programado.
 *
 * @returns IDs de los pedidos cancelados en esta corrida
 */
async function autoCancelExpiredPending(): Promise<string[]> {
	const cutoff = new Date(Date.now() - AUTO_CANCEL_MS);
	const now = new Date();

	const stale = await db
		.update(orders)
		.set({
			status: "cancelled",
			cancelledAt: now,
			cancelReason: AUTO_CANCEL_REASON,
			updatedAt: now,
		})
		.where(and(eq(orders.status, "pending"), lt(orders.createdAt, cutoff)))
		.returning({ id: orders.id, orderNumber: orders.orderNumber });

	if (stale.length === 0) return [];

	const staleIds = stale.map((row) => row.id);

	logger
		.withMetadata({ count: stale.length, orderIds: staleIds })
		.info("[Orders] Auto-cancel de pedidos pendientes vencidos");

	// Cancelamos los jobs delayed por orden para no desperdiciar lecturas en Redis
	// cuando dispare el worker (que ya sería no-op).
	await Promise.all(
		staleIds.map((id) =>
			removeOrderAutoCancel(id).catch((err) =>
				logger
					.withMetadata({ orderId: id })
					.withError(err)
					.warn("[Orders] failed to remove auto-cancel job (safety-net)"),
			),
		),
	);

	for (const row of stale) {
		notifyAdminsOfCancelledOrder({
			orderId: row.id,
			orderNumber: row.orderNumber,
			reason: AUTO_CANCEL_REASON,
		}).catch((err) =>
			logger
				.withMetadata({ orderId: row.id })
				.withError(err)
				.error("[Orders] Failed to notify admins of auto-cancel"),
		);
	}

	return staleIds;
}

// ═══════════════════════════════════════════════════
//  ATTACHMENTS
// ═══════════════════════════════════════════════════

// MAX_ATTACHMENTS imported from @/constants

async function updateAttachments(orderId: string, urls: string[]): Promise<OrderResponse> {
	const [order] = await db
		.select({ id: orders.id, attachments: orders.attachments })
		.from(orders)
		.where(eq(orders.id, orderId))
		.limit(1);

	if (!order) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Pedido no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	if (urls.length > MAX_ATTACHMENTS) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: `Máximo ${MAX_ATTACHMENTS} adjuntos permitidos`,
			logLevel: "info",
			doNotLog: true,
		});
	}

	const current = parseJsonArray(order.attachments);
	const uniqueUrls = [...new Set(urls)];
	const removed = current.filter((url) => !uniqueUrls.includes(url));

	// Step 1: persist the new list first (with pending URLs still in place).
	// If this fails, no objects have been moved yet — no orphaned storage.
	await db
		.update(orders)
		.set({ attachments: uniqueUrls, updatedAt: new Date() })
		.where(eq(orders.id, orderId));

	// Step 2: move pending objects to permanent location. Errors here are
	// non-fatal: the DB already has the pending URLs, which are still valid
	// references to the temporary objects.
	const resolved = await Promise.all(
		uniqueUrls.map(async (url) => {
			if (!isPendingUrl(url)) return url;

			const key = extractKeyFromUrl(url);
			if (!key) return url;

			const filename = key.split("/").pop() || key;
			const permanentKey = `orders/${orderId}/${filename}`;

			try {
				await moveObject(key, permanentKey);
				return getPublicUrl(permanentKey);
			} catch (error) {
				logger
					.withError(error)
					.withMetadata({ orderId, url })
					.warn("[Orders] No se pudo resolver adjunto pendiente");
				return url;
			}
		}),
	);

	// Step 3: update DB with resolved permanent URLs. The objects are now
	// safely in their permanent location regardless of this update outcome.
	await db
		.update(orders)
		.set({ attachments: resolved, updatedAt: new Date() })
		.where(eq(orders.id, orderId));

	// Step 4: clean up removed attachments.
	await Promise.all(removed.map((url) => deleteEntityAttachment(url)));
	const updated = await getById(orderId, true);

	if (!updated) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al actualizar adjuntos",
		});
	}

	return updated;
}

// ═══════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════

/**
 * Cancela una orden específica si aún está `pending`. Usado por el worker
 * de auto-cancel per-orden. Idempotente.
 *
 * @returns `true` si la cancelación se aplicó en esta llamada
 */
async function cancelIfStillPending(orderId: string): Promise<boolean> {
	const [order] = await db
		.select({ status: orders.status, orderNumber: orders.orderNumber })
		.from(orders)
		.where(eq(orders.id, orderId))
		.limit(1);

	if (!order || order.status !== "pending") return false;

	const now = new Date();
	const updated = await db
		.update(orders)
		.set({
			status: "cancelled",
			cancelledAt: now,
			cancelReason: AUTO_CANCEL_REASON,
			updatedAt: now,
		})
		.where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
		.returning({ id: orders.id });

	if (updated.length === 0) return false;

	logger
		.withMetadata({ orderId, orderNumber: order.orderNumber })
		.info("[Orders] Auto-cancel aplicado por worker");

	notifyAdminsOfCancelledOrder({
		orderId,
		orderNumber: order.orderNumber,
		reason: AUTO_CANCEL_REASON,
	}).catch((err) =>
		logger
			.withMetadata({ orderId })
			.withError(err)
			.error("[Orders] Failed to notify admins of auto-cancel"),
	);

	return true;
}

// ═══════════════════════════════════════════════════
//  BATCH
// ═══════════════════════════════════════════════════

async function batchUpdate(
	ids: string[],
	action: "confirmed" | "cancelled" | "refunded",
): Promise<{ succeeded: string[]; failed: Array<{ id: string; reason: string }> }> {
	const succeeded: string[] = [];
	const failed: Array<{ id: string; reason: string }> = [];

	for (const id of ids) {
		try {
			await updateStatus(id, {
				status: action,
			});
			succeeded.push(id);
		} catch (err) {
			const reason = err instanceof Error ? err.message : "Error desconocido al procesar pedido";
			failed.push({ id, reason });
		}
	}

	return { succeeded, failed };
}

export const OrderService = {
	create,
	getById,
	listByUser,
	listAdmin,
	updateStatus,
	updateAttachments,
	cancelByUser,
	batchUpdate,
	cancelIfStillPending,
	autoCancelExpiredPending,
};
