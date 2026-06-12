import type { CartResponse } from "@/features/cart/hooks/queries";

type CartItem = NonNullable<CartResponse>["items"][number];

function toNumber(price: string): number {
	const value = Number.parseFloat(price);
	return Number.isNaN(value) ? 0 : value;
}

export function isAvailableCartItem(item: CartItem): boolean {
	return item.status === "available";
}

export function summarizeAvailableCartItems(items: CartItem[]) {
	const availableItems = items.filter(isAvailableCartItem);
	const itemsCount = availableItems.reduce((sum, item) => sum + item.quantity, 0);
	const subtotal = availableItems
		.reduce((sum, item) => sum + toNumber(item.addedAtPrice) * item.quantity, 0)
		.toFixed(2);

	return {
		availableItems,
		availableItemsCount: itemsCount,
		availableSubtotal: subtotal,
		hasUnavailableItems: availableItems.length < items.length,
	};
}
