/**
 * Review reasons are stored as a single semicolon-joined string on products
 * (`needsReview` + `reviewReason`). Every writer used to split and join that
 * string by hand, which is how stale reasons survived in production (16
 * products stayed hidden behind "Sin marca" after the brand was set).
 *
 * These helpers are the only supported way to touch the string, so adding a
 * reason twice or removing one that is not there is impossible.
 */

export const REVIEW_REASONS = {
	missingImage: "Sin imagen",
	missingBrand: "Sin marca",
	missingCategory: "Sin categoria",
	aiUnsure: "IA no confia en datos",
	duplicate: "Posible duplicado",
	invalidPrice: "Precio inválido o fuera de rango",
} as const;

export function parseReviewReasons(current: string | null | undefined): string[] {
	return (current ?? "")
		.split(";")
		.map((reason) => reason.trim())
		.filter(Boolean);
}

export function hasReviewReason(current: string | null | undefined, reason: string): boolean {
	return parseReviewReasons(current).includes(reason);
}

/** Appends a reason once, preserving the existing order. */
export function addReviewReason(current: string | null | undefined, reason: string): string {
	const reasons = parseReviewReasons(current);
	if (!reasons.includes(reason)) {
		reasons.push(reason);
	}
	return reasons.join("; ");
}

/** Removes a reason; returns null when no reasons are left. */
export function removeReviewReason(
	current: string | null | undefined,
	reason: string,
): string | null {
	const reasons = parseReviewReasons(current).filter((item) => item !== reason);
	return reasons.length > 0 ? reasons.join("; ") : null;
}

export interface ReviewContext {
	hasBrand: boolean;
	hasCategory: boolean;
	hasImage: boolean;
	/** Set when a human saved the product: clears the model-confidence reason. */
	reviewedByAdmin?: boolean;
}

/**
 * Reconciles the reasons that no longer apply once their cause is fixed.
 *
 * A stale reason keeps a product hidden from the storefront forever, and that
 * happened in production: 16 products stayed behind "Sin marca" long after the
 * brand was set, because every writer only appended reasons.
 */
export function recomputeReviewReasons(
	current: string | null | undefined,
	context: ReviewContext,
): { needsReview: boolean; reviewReason: string | null } {
	const stale = new Set<string>();
	if (context.hasBrand) stale.add(REVIEW_REASONS.missingBrand);
	if (context.hasCategory) stale.add(REVIEW_REASONS.missingCategory);
	if (context.hasImage) stale.add(REVIEW_REASONS.missingImage);
	if (context.reviewedByAdmin) {
		// A human saving the product is a review: the model doubts and the
		// duplicate warning have been looked at.
		stale.add(REVIEW_REASONS.aiUnsure);
		stale.add(REVIEW_REASONS.duplicate);
	}

	const reasons = parseReviewReasons(current).filter((reason) => !stale.has(reason));
	return {
		needsReview: reasons.length > 0,
		reviewReason: reasons.length > 0 ? reasons.join("; ") : null,
	};
}
