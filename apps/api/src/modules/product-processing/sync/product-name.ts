/**
 * Product name helpers for the sync.
 *
 * `products.name` is UNIQUE and the model does not guarantee a distinct name per
 * listing: the same product re-listed under a new provider id, or two raws that
 * collapse into one name, would otherwise fail the insert on every sync forever.
 */

export const PRODUCT_NAME_MAX = 255;

/** Room for the provider suffix: the id is alphanumeric, bounded by the model. */
export function suffixProductName(baseName: string, providerId: string): string {
	const suffix = ` (${providerId})`;
	return `${baseName.slice(0, PRODUCT_NAME_MAX - suffix.length)}${suffix}`;
}
