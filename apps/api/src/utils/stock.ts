import { db } from "@renovabit/db";
import { ORDER_RESERVATION_STATUSES } from "@renovabit/db/orders";
import { orderItems, orders, products } from "@renovabit/db/schema";
import type { AnyColumn } from "drizzle-orm";
import { and, eq, inArray, sql } from "drizzle-orm";

/**
 * Cantidad de unidades de un producto reservadas por órdenes `pending`.
 * El stock físico (`products.stock`) llega del sync del proveedor.
 * Al confirmar un pedido se descuenta el stock físico y la reserva se libera,
 * por eso solo `pending` reserva.
 *
 * Stock disponible = products.stock - getReservedStock(productId).
 */
export async function getReservedStock(productId: string): Promise<number> {
	const [result] = await db
		.select({
			reserved: sql<number>`COALESCE(SUM(${orderItems.quantity})::int, 0)`,
		})
		.from(orderItems)
		.innerJoin(orders, eq(orders.id, orderItems.orderId))
		.where(
			and(eq(orderItems.productId, productId), inArray(orders.status, ORDER_RESERVATION_STATUSES)),
		);

	return Number(result?.reserved ?? 0);
}

/**
 * Stock disponible para venta: stock físico menos reservas de órdenes `pending`.
 * Nunca retorna negativo.
 */
export async function getAvailableStock(productId: string): Promise<number> {
	const [product] = await db
		.select({ stock: products.stock })
		.from(products)
		.where(eq(products.id, productId))
		.limit(1);

	if (!product) return 0;
	const reserved = await getReservedStock(productId);
	return Math.max(0, product.stock - reserved);
}

/**
 * SQL fragment usable en queries Drizzle para computar la reserva inline.
 *
 * Uso:
 * ```ts
 * .where(sql`${products.stock} - (${getReservedStockSubquery(products.id)}) > 0`)
 * ```
 */
export function getReservedStockSubquery(productIdCol: AnyColumn) {
	const statusList = ORDER_RESERVATION_STATUSES.map((s) => `'${s}'`).join(", ");
	return sql`(
		SELECT COALESCE(SUM(oi.quantity), 0)
		FROM ${orderItems} oi
		INNER JOIN ${orders} o ON o.id = oi.order_id
		WHERE oi.product_id = ${productIdCol}
		AND o.status IN (${sql.raw(statusList)})
	)`;
}
