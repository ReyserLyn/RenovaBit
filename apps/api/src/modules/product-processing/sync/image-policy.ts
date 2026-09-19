/**
 * When to re-check a supplier image.
 *
 * The image URL is deterministic per provider id (`.../fotos/{id}.png`), so a
 * plain re-fetch cannot detect a *changed* file — it only detects a *removed*
 * one. The sync did it anyway for every product on every run: ~900 requests
 * with 100-300 ms sleeps each, every ten minutes, for no new information.
 *
 * The check is now scheduled: fresh when the image was never fetched, and
 * every IMAGE_RECHECK_HOURS otherwise.
 */

export const IMAGE_RECHECK_HOURS = 12;

export interface ImageCheckState {
	rawImageUrl: string | null;
	rawImageHash: string | null;
	imageCheckedAt: Date | null;
}

/**
 * The timestamp is the only thing that gates the check. Deciding from the hash
 * would re-fetch forever the items the supplier never had an image for (the
 * hash stays null), which is exactly the hammering this policy exists to stop.
 */
export function shouldCheckProviderImage(state: ImageCheckState, now: Date = new Date()): boolean {
	// Never checked (new row) or a legacy row without a timestamp.
	if (!state.imageCheckedAt) return true;

	const elapsedMs = now.getTime() - state.imageCheckedAt.getTime();
	return elapsedMs >= IMAGE_RECHECK_HOURS * 60 * 60 * 1000;
}
