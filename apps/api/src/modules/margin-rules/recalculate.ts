import { db } from "@renovabit/db";
import { products } from "@renovabit/db/schema";
import { getEffectiveSalePrice } from "@renovabit/pricing";
import { eq, sql } from "drizzle-orm";
import { logger } from "@/utils/logger";
import { getActiveMarginRules } from "@/utils/margin-rules";

/**
 * `products.price` is a cache of the effective sale price for provider-managed
 * products.
 *
 * The storefront and checkout always compute the price live (supplier cost plus
 * the active rules), but the stored value is what drives price sorting, the
 * public min/max filters and the admin table. Changing a rule invalidates that
 * cache, and without this refresh the admin keeps showing — and the catalog
 * keeps sorting by — prices from the previous rule set.
 *
 * Manual products are skipped on purpose: their stored price is the owner's,
 * not a derived value.
 */
export async function recalculateStoredPrices(): Promise<{ checked: number; updated: number }> {
	const rules = await getActiveMarginRules();

	const rows = await db
		.select({
			id: products.id,
			supplierPrice: products.supplierPrice,
			roleCustomMargins: products.roleCustomMargins,
			price: products.price,
		})
		.from(products)
		.where(eq(products.managedBy, "provider"));

	const updates: Array<{ id: string; price: string }> = [];
	for (const row of rows) {
		const { salePrice } = getEffectiveSalePrice(
			{ supplierPrice: row.supplierPrice, roleCustomMargins: row.roleCustomMargins },
			"customer",
			rules,
		);
		const next = salePrice.toFixed(2);
		if (next !== row.price) updates.push({ id: row.id, price: next });
	}

	const BATCH_SIZE = 200;
	for (let offset = 0; offset < updates.length; offset += BATCH_SIZE) {
		const batch = updates.slice(offset, offset + BATCH_SIZE);
		const values = batch.map((item) => sql`(${item.id}::uuid, ${item.price}::numeric)`);
		await db.execute(sql`
			UPDATE products
			SET price = v.price, updated_at = now()
			FROM (VALUES ${sql.join(values, sql`, `)}) AS v(id, price)
			WHERE products.id = v.id
		`);
	}

	logger
		.withMetadata({ checked: rows.length, updated: updates.length })
		.info("[pricing] caché de precios recalculada tras un cambio de reglas");

	return { checked: rows.length, updated: updates.length };
}
