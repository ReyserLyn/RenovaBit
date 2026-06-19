import { ORDER_RESERVATION_STATUSES } from "@renovabit/db/orders";
import { orderItems, orders } from "@renovabit/db/schema";
import type { AnyColumn } from "drizzle-orm";
import { and, eq, inArray, sql } from "drizzle-orm";

/**
 * SQL fragment usable en queries Drizzle para computar la reserva inline.
 * El stock físico (`products.stock`) llega del sync del proveedor; al confirmar
 * un pedido se descuenta el stock físico y la reserva se libera, por eso solo
 * los estados en `ORDER_RESERVATION_STATUSES` (e.g. `pending`) reservan.
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

/**
 * Obtiene el stock reservado para un producto dentro de una transacción activa.
 * Reemplaza el bloque duplicado de:
 * ```
 * .select({ reserved: sql<number>\`COALESCE(SUM(...)::int, 0)\` })
 * ```
 * que aparece 4 veces en cart/service.ts y orders/service.ts.
 *
 * @param tx — Transacción Drizzle activa (el parámetro del callback de `db.transaction(tx => ...)`)
 * @param productId — ID del producto a consultar
 */
export async function getReservedStockForProductInTx(
	// biome-ignore lint/suspicious/noExplicitAny: Drizzle tx type is complex; internal helper
	tx: any,
	productId: string,
): Promise<number> {
	const [result] = await tx
		.select({ reserved: sql<number>`COALESCE(SUM(${orderItems.quantity})::int, 0)` })
		.from(orderItems)
		.innerJoin(orders, eq(orders.id, orderItems.orderId))
		.where(
			and(eq(orderItems.productId, productId), inArray(orders.status, ORDER_RESERVATION_STATUSES)),
		);
	return result?.reserved ?? 0;
}
