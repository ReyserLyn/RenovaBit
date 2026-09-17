import { orderItems, orders, products } from "@renovabit/db/schema";
import type { AnyColumn } from "drizzle-orm";
import { eq, sql } from "drizzle-orm";
import { CONFIRMED_HOLD_SECONDS } from "@/constants";

/**
 * Modelo de stock (un solo escritor)
 * ──────────────────────────────────
 * `products.stock` pertenece al feed del proveedor: el sync lo escribe en
 * absoluto cada ~10 min y el sistema de pedidos NUNCA lo modifica. La
 * disponibilidad se calcula como `stock - retenciones`, donde una retención es
 * cualquier pedido que ya reclamó una unidad:
 *
 *   - `pending`: la retiene mientras espera pago/confirmación.
 *   - `confirmed` dentro de la ventana de gracia (`CONFIRMED_HOLD_SECONDS`):
 *     sigue retenida porque el feed del proveedor todavía no reflejó nuestra
 *     compra. Pasada la gracia se libera: el feed ya es la única verdad.
 *
 * Esto elimina el doble escritor (el decremento local que el sync pisaba en su
 * siguiente corrida → phantom stock → sobreventa).
 */

/**
 * SQL fragment usable en queries Drizzle para computar la retención inline.
 *
 * Uso:
 * ```ts
 * .where(sql`${products.stock} - (${getReservedStockSubquery(products.id)}) > 0`)
 * ```
 */
export function getReservedStockSubquery(productIdCol: AnyColumn) {
	return sql`(
		SELECT COALESCE(SUM(oi.quantity), 0)
		FROM ${orderItems} oi
		INNER JOIN ${orders} o ON o.id = oi.order_id
		INNER JOIN ${products} p ON p.id = oi.product_id
		WHERE oi.product_id = ${productIdCol}
		AND (
			o.status = 'pending'
			OR (
				o.status = 'confirmed'
				AND p.managed_by = 'provider'
				AND o.confirmed_at > now() - make_interval(secs => ${CONFIRMED_HOLD_SECONDS})
			)
		)
	)`;
}

/**
 * Obtiene la retención de un producto dentro de una transacción activa.
 *
 * Reutiliza la subquery canónica (única definición del modelo) usando una fila
 * de `order_items` como pivote: la subquery es idéntica en cada fila, así que
 * devolver la primera basta. Si el producto no tiene items, la retención es 0.
 *
 * @param tx — Transacción Drizzle activa (el parámetro del callback de `db.transaction`)
 * @param productId — ID del producto a consultar
 */
export async function getReservedStockForProductInTx(
	// biome-ignore lint/suspicious/noExplicitAny: Drizzle tx type is complex; internal helper
	tx: any,
	productId: string,
): Promise<number> {
	const [row] = await tx
		.select({ reserved: sql<number>`(${getReservedStockSubquery(orderItems.productId)})::int` })
		.from(orderItems)
		.where(eq(orderItems.productId, productId))
		.limit(1);
	return row?.reserved ?? 0;
}
