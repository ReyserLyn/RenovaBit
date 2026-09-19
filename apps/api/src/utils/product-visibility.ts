/**
 * Public visibility SSOT for the `needsReview` / `reviewReason` pair.
 *
 * The pair is a single semicolon-joined string (see `review-reasons.ts`).
 * Before this module, every public query hid any product with
 * `needsReview = true`, so a reason the operator can fix later (a missing
 * supplier image) also hid the product from the storefront forever.
 *
 * These reasons are ADVISORY: they flag the product in the admin review queue
 * but they do not hide it from the store. The storefront renders its static
 * placeholder when a product has no image.
 *
 * The same rule gates purchases: cart and checkout must reject only products
 * with a BLOCKING reason, not advisory-only ones. The SQL predicate below and
 * the TS helpers at the bottom of this module are twins — both derive from
 * `ADVISORY_REVIEW_REASONS`, so change them together.
 */
import { products } from "@renovabit/db/schema";
import { sql } from "drizzle-orm";
import { parseReviewReasons, REVIEW_REASONS } from "@/utils/review-reasons";

/** Advisory reasons: they flag the operator without hiding the product. */
export const ADVISORY_REVIEW_REASONS = [REVIEW_REASONS.missingImage] as const;

/**
 * Semicolon separator with optional surrounding whitespace. The writers in
 * `review-reasons.ts` join with `"; "`, but production rows also carry variants
 * like `"Sin imagen;  Sin marca"`, so the split tolerates it.
 */
const REVIEW_REASON_SPLIT_PATTERN = "\\s*;\\s*";

const ADVISORY_REASONS_ARRAY = sql`ARRAY[${sql.join(
	ADVISORY_REVIEW_REASONS.map((reason) => sql`${reason}`),
	sql`, `,
)}]::text[]`;

/**
 * Drizzle fragment for every PUBLIC product query.
 *
 * A product is publicly visible when any of these holds:
 * - it is not flagged for review;
 * - it is flagged but carries no reason (nothing actionable to block on);
 * - every reason in its list is advisory.
 *
 * A single blocking reason (missing brand/category, AI distrust, duplicate,
 * invalid price) keeps the product out of the storefront, exactly as before.
 *
 * This replaces `eq(products.needsReview, false)`. Admin queries keep reading
 * the raw columns, so the review queue is unchanged.
 */
export const reviewVisibleCondition = sql`(
	NOT ${products.needsReview}
	OR ${products.reviewReason} IS NULL
	OR regexp_split_to_array(${products.reviewReason}, ${REVIEW_REASON_SPLIT_PATTERN}) <@ ${ADVISORY_REASONS_ARRAY}
)`;

/**
 * TypeScript twin of `reviewVisibleCondition` for application-code gates.
 *
 * Cart and checkout used to reject any product with `needsReview = true`,
 * which diverged from the public rule above: an advisory-only reason
 * ("Sin imagen") left products visible but not buyable. This predicate keeps
 * both sides on the same SSOT — a reason blocks only when it is NOT advisory,
 * unknown reasons included (conservative default).
 *
 * A bare flag with no reason returns false: there is nothing actionable, the
 * same semantics as the SQL predicate.
 */
export function hasBlockingReviewReason(reviewReason: string | null | undefined): boolean {
	return parseReviewReasons(reviewReason).some(
		(reason) => !(ADVISORY_REVIEW_REASONS as readonly string[]).includes(reason),
	);
}

/**
 * Whether a product can be purchased: active AND free of blocking review
 * reasons. `isActive` stays mandatory.
 *
 * Read-only: callers must not write `needsReview` / `reviewReason` from
 * purchase paths — the flag is operator data and survives the sale.
 */
export function isPurchasable(product: {
	isActive: boolean;
	reviewReason: string | null;
}): boolean {
	return product.isActive && !hasBlockingReviewReason(product.reviewReason);
}
