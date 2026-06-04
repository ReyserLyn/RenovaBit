/**
 * Helper de meta tags SEO estándar de TanStack Start.
 *
 * Basado en el utility que usan todos los ejemplos oficiales:
 * https://github.com/TanStack/router/tree/main/examples/react
 *
 * Uso en una ruta:
 * ```ts
 * head: () => ({
 *   meta: [
 *     { charSet: "utf-8" },
 *     { name: "viewport", content: "width=device-width, initial-scale=1" },
 *     ...seo({ title: "Mi página", description: "...", image: "..." }),
 *   ],
 * })
 * ```
 */
export function seo({
	title,
	description,
	image,
	keywords,
}: {
	title: string;
	description?: string;
	image?: string;
	keywords?: string;
}) {
	const tags: Array<{ title?: string; name?: string; content?: string; property?: string }> = [
		{ title },
	];

	if (description) {
		tags.push({ name: "description", content: description });
	}

	if (keywords) {
		tags.push({ name: "keywords", content: keywords });
	}

	// Open Graph
	tags.push({ property: "og:title", content: title });
	if (description) {
		tags.push({ property: "og:description", content: description });
	}
	tags.push({ property: "og:type", content: "website" });

	// Twitter Card
	tags.push({ name: "twitter:title", content: title });
	if (description) {
		tags.push({ name: "twitter:description", content: description });
	}
	tags.push({ name: "twitter:card", content: "summary_large_image" });

	if (image) {
		tags.push({ name: "twitter:image", content: image });
		tags.push({ name: "twitter:card", content: "summary_large_image" });
		tags.push({ property: "og:image", content: image });
	}

	return tags;
}
