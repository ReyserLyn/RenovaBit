import slugify from "slugify";

/**
 * Genera un slug URL-friendly a partir de un texto.
 *
 * SSOT para generación de slugs en toda la tienda.
 * Usa la librería `slugify` internamente.
 *
 * @example
 *   generateSlug("Laptop Gamer ASUS") // → "laptop-gamer-asus"
 *   generateSlug("  Samsung 4K  ")    // → "samsung-4k"
 */
export function generateSlug(text: string): string {
	return slugify(text, {
		lower: true,
		strict: true,
		trim: true,
	});
}
