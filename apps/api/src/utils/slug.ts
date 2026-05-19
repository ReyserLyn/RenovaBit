import slugify from "slugify";

// Configure slugify with common replacements
slugify.extend({
	"@": "at",
	"&": "and",
});

/**
 * Generates a URL-friendly slug from a string
 *
 * @param text - The text to slugify
 * @returns URL-safe slug string (lowercase, trimmed, strict)
 *
 * @example
 * ```typescript
 * generateSlug("Nike") // "nike"
 * generateSlug("Café & Té") // "cafe-te"
 * generateSlug("New Brand @ Store") // "new-brand-at-store"
 * ```
 */
export function generateSlug(text: string): string {
	return slugify(text, {
		lower: true,
		strict: true,
		trim: true,
	});
}
