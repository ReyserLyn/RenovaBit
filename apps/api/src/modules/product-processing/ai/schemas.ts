import { z } from "zod";

/**
 * The model output is untrusted: the prompt embeds a third-party supplier
 * string and the result is stored, rendered and injected into JSON-LD, so an
 * HTML break-out must be rejected at the source. The storefront escapes `<`
 * when serializing JSON-LD as a second line of defence.
 */
function isSafeText(val: string): boolean {
	return !val.includes("</") && !/<[a-z!/]/i.test(val);
}

/** Bounded text: caps mirror the DB columns and keep inserts from failing. */
function safeText(max: number) {
	return z.string().max(max).refine(isSafeText, "Unsafe HTML break-out in AI output");
}

export const productSpecSchema = z.object({
	id: z.string().max(64),
	key: safeText(60),
	value: safeText(200),
});

export const productExtractionSchema = z.object({
	name: safeText(200),
	brand: safeText(80),
	category: safeText(80),
	description: safeText(10_000),
	specifications: z.array(productSpecSchema).max(50),
	needsReview: z.boolean(),
});

export type ProductExtractionOutput = z.infer<typeof productExtractionSchema>;
