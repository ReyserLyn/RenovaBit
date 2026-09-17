import { db } from "@renovabit/db";
import { AUTO_CANCEL_MS } from "@renovabit/db/constants";
import type { OrderSource, OrderStatus, PaymentMethod } from "@renovabit/db/orders";
import { orderItems, orders, products, users } from "@renovabit/db/schema";
import type { SQL } from "drizzle-orm";
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/constants";
import { removeOrderAutoCancel } from "@/jobs/orders.queue";
import { formatDate } from "@/utils/date";
import { logger } from "@/utils/logger";
import type { OrderListItem, OrderResponse } from "../model";
import { AUTO_CANCEL_REASON, parseJsonArray } from "./internal";

// ═══════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════

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

/** Peru has no DST: fixed UTC-05:00 offset. */
const LIMA_OFFSET = "-05:00";

/**
 * Parses a `YYYY-MM-DD` admin date filter as a Lima-day boundary.
 *
 * The server runs in UTC, so a raw date parsed as UTC midnight would shift the
 * window five hours: `to` would drop the Peruvian evening (the sales peak) and
 * `from` would include the previous evening.
 */
function limaDayBoundary(value: string, boundary: "start" | "end"): Date | null {
	const time = boundary === "start" ? "00:00:00.000" : "23:59:59.999";
	const parsed = new Date(value.includes("T") ? value : `${value}T${time}${LIMA_OFFSET}`);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// ═══════════════════════════════════════════════════
//  RESPONSE BUILDER (SSOT)
// ═══════════════════════════════════════════════════

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

	// Business priority instead of alphabetical enum order: orders needing
	// action first, terminal states last.
	const statusPriority = sql`CASE ${orders.status}
		WHEN 'pending' THEN 0
		WHEN 'confirmed' THEN 1
		WHEN 'cancelled' THEN 2
		ELSE 3
	END`;

	const orderBy =
		sortBy === "total"
			? sortOrder === "asc"
				? sql`${orders.total}::numeric asc`
				: sql`${orders.total}::numeric desc`
			: sortBy === "status"
				? sortOrder === "asc"
					? sql`${statusPriority} asc`
					: sql`${statusPriority} desc`
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

	return queryOrderList(where, page, limit);
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
		const fromDate = limaDayBoundary(options.from, "start");
		if (fromDate) {
			conditions.push(gte(orders.createdAt, fromDate));
		}
	}
	if (options.to) {
		const toDate = limaDayBoundary(options.to, "end");
		if (toDate) {
			conditions.push(lte(orders.createdAt, toDate));
		}
	}
	if (options.search) {
		const term = `%${options.search}%`;
		conditions.push(or(ilike(orders.orderNumber, term), ilike(orders.customerName, term)));
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	return queryOrderList(where, options.page, options.limit, options.sortBy, options.sortOrder);
}

// ═══════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════

export type { OrderRow };
export { buildOrderResponse, getById, listAdmin, listByUser };
