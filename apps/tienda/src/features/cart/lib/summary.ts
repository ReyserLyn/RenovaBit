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

	// Use role-aware pricing: currentOfferPrice if offers apply, else currentRolePrice
	const subtotal = availableItems
		.reduce((sum, item) => {
			const rolePrice = toNumber(item.currentRolePrice);
			const offerPrice = toNumber(item.currentOfferPrice);
			const effectivePrice = offerPrice < rolePrice ? offerPrice : rolePrice;
			return sum + effectivePrice * item.quantity;
		}, 0)
		.toFixed(2);

	return {
		availableItems,
		availableItemsCount: itemsCount,
		availableSubtotal: subtotal,
		hasUnavailableItems: availableItems.length < items.length,
	};
}
