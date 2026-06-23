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

interface ProductJsonLdInput {
	name: string;
	description?: string | null;
	image?: string | null;
	sku: string;
	price: string;
	offerPrice?: string | null;
	priceValidUntil?: string | null;
	availability: "in_stock" | "out_of_stock";
	url: string;
	brand?: { name: string; slug: string } | null;
}

const AVAILABILITY_MAP = {
	in_stock: "https://schema.org/InStock",
	out_of_stock: "https://schema.org/OutOfStock",
} as const;

export function productJsonLd(product: ProductJsonLdInput) {
	const currentPrice = product.offerPrice ?? product.price;
	const hasSale = product.offerPrice !== null && product.offerPrice !== undefined;

	const offer: Record<string, unknown> = {
		"@type": "Offer",
		url: product.url,
		priceCurrency: "PEN",
		price: currentPrice,
		availability: AVAILABILITY_MAP[product.availability],
		seller: {
			"@type": "Organization",
			name: "Renovabit",
		},
	};

	if (hasSale) {
		offer.priceValidUntil = product.priceValidUntil ?? undefined;
	}

	const jsonLd: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": "Product",
		name: product.name,
		sku: product.sku,
		url: product.url,
		...(product.image ? { image: product.image } : {}),
		...(product.description ? { description: product.description } : {}),
		...(product.brand
			? {
					brand: {
						"@type": "Brand",
						name: product.brand.name,
					},
				}
			: {}),
		offers: offer,
	};

	return {
		type: "application/ld+json",
		children: JSON.stringify(jsonLd),
	};
}

interface OfferListItem {
	name: string;
	url: string;
	price: string;
	priceCurrency?: string;
	validThrough: string;
}

export function offerListJsonLd(offers: OfferListItem[]) {
	return {
		type: "application/ld+json",
		children: JSON.stringify({
			"@context": "https://schema.org",
			"@type": "ItemList",
			itemListElement: offers.map((offer, i) => ({
				"@type": "ListItem",
				position: i + 1,
				item: {
					"@type": "Offer",
					name: offer.name,
					url: offer.url,
					price: offer.price,
					priceCurrency: offer.priceCurrency ?? "PEN",
					priceValidUntil: offer.validThrough,
					availability: "https://schema.org/InStock",
					seller: { "@type": "Organization", name: "Renovabit" },
				},
			})),
		}),
	};
}
