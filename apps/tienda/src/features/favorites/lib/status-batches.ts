/**
 * `GET /favorites/status` accepts at most 200 productIds per request
 * (`favoriteStatusBatchQuery` maxItems). Larger listings must be split so the
 * API never rejects the whole batch and the hook doesn't silently fall back
 * to "not favorite" for every product.
 */
export const FAVORITE_STATUS_BATCH_SIZE = 200;

/**
 * Deduplicates and splits ids into batches of `size`. Duplicates are dropped
 * so repeated productIds in a listing (e.g. same product in two carousels)
 * don't consume the API cap twice.
 */
export function chunkProductIds(
	productIds: ReadonlyArray<string>,
	size: number = FAVORITE_STATUS_BATCH_SIZE,
): string[][] {
	if (size < 1) throw new Error("Batch size must be at least 1");

	const uniqueIds = [...new Set(productIds)];
	const batches: string[][] = [];
	for (let index = 0; index < uniqueIds.length; index += size) {
		batches.push(uniqueIds.slice(index, index + size));
	}
	return batches;
}
