import type { CartResponse } from "@/features/cart/hooks/queries";
import { getEffectiveLinePrice } from "@/features/cart/lib/pricing";

type CartItem = NonNullable<CartResponse>["items"][number];

export function isAvailableCartItem(item: CartItem): boolean {
	return item.status === "available";
}

export function summarizeAvailableCartItems(items: CartItem[]) {
	const availableItems = items.filter(isAvailableCartItem);

	let subtotal = 0;
	let saved = 0;
	for (const item of availableItems) {
		const { unitPrice, unitSaved } = getEffectiveLinePrice(item);
		subtotal += unitPrice * item.quantity;
		saved += unitSaved * item.quantity;
	}

	const itemsCount = availableItems.reduce((sum, item) => sum + item.quantity, 0);
	const hasUnavailableItems = availableItems.length < items.length;

	return {
		availableItems,
		availableItemsCount: itemsCount,
		availableSubtotal: subtotal.toFixed(2),
		totalSaved: saved > 0 ? saved.toFixed(2) : null,
		hasUnavailableItems,
	};
}
