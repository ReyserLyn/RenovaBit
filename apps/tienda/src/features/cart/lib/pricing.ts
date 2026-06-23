import type { CartResponse } from "@/features/cart/hooks/queries";

type CartItem = NonNullable<CartResponse>["items"][number];

export interface EffectiveLinePrice {
	/** Per-unit price the user actually pays for this line. */
	unitPrice: number;
	/** Per-unit savings against the tier price (0 when no offer applies). */
	unitSaved: number;
	/** unitPrice * quantity, rounded to 2 decimals as a string. */
	lineTotal: string;
	/** unitSaved * quantity, rounded to 2 decimals as a string. */
	lineSaved: string;
}

/**
 * Parse a price string defensively. Returns 0 for any non-finite input so
 * downstream arithmetic never produces NaN totals.
 */
function toFinitePrice(value: string | null | undefined): number {
	if (value === null || value === undefined) return 0;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

export function getEffectiveLinePrice(item: CartItem): EffectiveLinePrice {
	const rolePrice = toFinitePrice(item.currentRolePrice);
	const offerPrice = toFinitePrice(item.currentOfferPrice);
	const unitSaved = Math.max(0, rolePrice - offerPrice);
	const unitPrice = unitSaved > 0 ? offerPrice : rolePrice;
	const lineTotal = (unitPrice * item.quantity).toFixed(2);
	const lineSaved = (unitSaved * item.quantity).toFixed(2);
	return { unitPrice, unitSaved, lineTotal, lineSaved };
}
