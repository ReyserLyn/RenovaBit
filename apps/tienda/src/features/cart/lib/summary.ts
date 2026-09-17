import type { CartResponse } from "@/features/cart/hooks/queries";
import { getEffectiveLinePrice } from "@/features/cart/lib/pricing";

type CartItem = NonNullable<CartResponse>["items"][number];

/**
 * Orderable = the item can be checked out. `price_changed` is orderable: the
 * cart total already reflects the current price and the API re-prices again at
 * checkout. Only `out_of_stock` and `unavailable` block an order.
 */
export function isOrderableCartItem(item: CartItem): boolean {
	return item.status === "available" || item.status === "price_changed";
}

export function summarizeOrderableCartItems(items: CartItem[]) {
	const orderableItems = items.filter(isOrderableCartItem);

	let subtotal = 0;
	let saved = 0;
	for (const item of orderableItems) {
		const { unitPrice, unitSaved } = getEffectiveLinePrice(item);
		subtotal += unitPrice * item.quantity;
		saved += unitSaved * item.quantity;
	}

	const itemsCount = orderableItems.reduce((sum, item) => sum + item.quantity, 0);
	const hasBlockedItems = orderableItems.length < items.length;
	const hasPriceChange = orderableItems.some((item) => item.priceChanged);

	return {
		orderableItems,
		orderableItemsCount: itemsCount,
		orderableSubtotal: subtotal.toFixed(2),
		totalSaved: saved > 0 ? saved.toFixed(2) : null,
		hasBlockedItems,
		hasPriceChange,
	};
}
