import { MAX_FEED_SUPPLIER_PRICE } from "@/constants";

/**
 * Detects placeholder prices (9999, 99999…, "2") used by the supplier as
 * "no price" markers. The decimal part is ignored so `9999.00` is detected
 * the same as `9999`.
 */
export function isPlaceholderPrice(rawPrice: string): boolean {
	const integerDigits = (rawPrice.split(".")[0] ?? "").replace(/[^0-9]/g, "");
	if (integerDigits.length >= 4 && /^9+$/.test(integerDigits)) return true;
	if (rawPrice.replace(/[^0-9]/g, "") === "2") return true;
	return false;
}

/**
 * Parses a supplier price from the feed.
 *
 * Returns `null` when the value must not be imported: unparseable, zero or
 * negative, or above {@link MAX_FEED_SUPPLIER_PRICE} (the page has been seen
 * reporting 10M/100M for cheap items). A `null` price is never clamped to 0 —
 * that would publish the product for free.
 */
export function parseFeedPrice(rawPrice: string): number | null {
	const price = Number.parseFloat(rawPrice);
	if (!Number.isFinite(price) || price <= 0) return null;
	if (price > MAX_FEED_SUPPLIER_PRICE) return null;
	return price;
}

/**
 * True when the feed price must not be processed at all (placeholder marker or
 * outside the sane range). Such items are skipped during the sync and marked
 * as seen so they are not treated as out-of-stock.
 */
export function isInvalidFeedPrice(rawPrice: string): boolean {
	return parseFeedPrice(rawPrice) === null || isPlaceholderPrice(rawPrice);
}
