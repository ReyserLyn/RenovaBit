export function seo({
	title,
	description,
	image,
	keywords,
	url,
}: {
	title: string;
	description?: string;
	image?: string;
	keywords?: string;
	url?: string;
}) {
	const meta: Array<{
		title?: string;
		name?: string;
		content?: string;
		property?: string;
	}> = [{ title }];

	if (description) {
		meta.push({ name: "description", content: description });
	}

	if (keywords) {
		meta.push({ name: "keywords", content: keywords });
	}

	meta.push({ property: "og:title", content: title });
	if (description) {
		meta.push({ property: "og:description", content: description });
	}
	meta.push({ property: "og:type", content: "website" });

	meta.push({ name: "twitter:title", content: title });
	if (description) {
		meta.push({ name: "twitter:description", content: description });
	}
	meta.push({ name: "twitter:card", content: "summary_large_image" });

	if (image) {
		meta.push({ name: "twitter:image", content: image });
		meta.push({ name: "twitter:card", content: "summary_large_image" });
		meta.push({ property: "og:image", content: image });
	}

	const links: Array<{ rel: string; hrefLang: string; href: string }> = [];

	if (url) {
		links.push({ rel: "alternate", hrefLang: "es-PE", href: url });
		links.push({ rel: "alternate", hrefLang: "x-default", href: url });
	}

	return { meta, links };
}

export function breadcrumbJsonLd(items: Array<{ name: string; url?: string }>) {
	return {
		type: "application/ld+json",
		children: JSON.stringify({
			"@context": "https://schema.org",
			"@type": "BreadcrumbList",
			itemListElement: items.map((item, i) => ({
				"@type": "ListItem",
				position: i + 1,
				name: item.name,
				...(item.url ? { item: item.url } : {}),
			})),
		}),
	};
}
