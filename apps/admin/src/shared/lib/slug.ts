import slugify from "slugify";

/**
 * Genera un slug URL-friendly a partir de un texto.
 *
 * SSOT para generación de slugs en toda la admin app.
 * Usa la librería `slugify` internamente.
 *
 * @example
 *   generateSlug("ASUS ROG")        // → "asus-rog"
 *   generateSlug("  Logitech  G ")  // → "logitech-g"
 *   generateSlug("Samsung 4K OLED") // → "samsung-4k-oled"
 */
export function generateSlug(text: string): string {
	return slugify(text, {
		lower: true,
		strict: true,
		trim: true,
	});
}
