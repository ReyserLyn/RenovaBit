import { createFileRoute } from "@tanstack/react-router";
import { api, unwrapResponse } from "@/shared/lib/api";
import { getSiteUrl } from "@/shared/lib/env";

const SITEMAP_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400";

/**
 * NOTE: the app-level `/**` route rule in vite.config.ts sets
 * `private, no-cache` for every route and Nitro applies route-rule headers
 * after the handler, so in the current build this Cache-Control is overridden.
 * A specific `/sitemap.xml` route rule (owned by the infra config) is required
 * for it to reach the client — see the handoff report.
 */

/** Public product list caps `limit` at 100 server-side. */
const PRODUCTS_PAGE_SIZE = 100;

const STATIC_PATHS = [
	"/",
	"/productos",
	"/ofertas",
	"/libro-de-reclamaciones",
	"/politica-de-privacidad",
	"/terminos-y-condiciones",
	"/politicas-de-envio-y-devolucion",
] as const;

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

/**
 * Walks the public category tree (already pruned of empty nodes by the API)
 * and collects every non-empty category slug.
 */
function collectCategorySlugs(nodes: unknown, acc: string[]): void {
	if (!Array.isArray(nodes)) return;
	for (const node of nodes) {
		if (typeof node !== "object" || node === null) continue;
		const record = node as Record<string, unknown>;
		if (typeof record.slug === "string" && record.slug.length > 0) {
			acc.push(record.slug);
		}
		collectCategorySlugs(record.children, acc);
	}
}

async function fetchProductSlugs(): Promise<string[]> {
	const first = await unwrapResponse(
		api.api.v1.products.get({ query: { limit: PRODUCTS_PAGE_SIZE, offset: 0 } }),
	);
	const slugs = first.data.map((product) => product.slug);
	const pageCount = Math.ceil(first.total / PRODUCTS_PAGE_SIZE);

	if (pageCount > 1) {
		const pages = await Promise.all(
			Array.from({ length: pageCount - 1 }, (_, index) =>
				unwrapResponse(
					api.api.v1.products.get({
						query: { limit: PRODUCTS_PAGE_SIZE, offset: (index + 1) * PRODUCTS_PAGE_SIZE },
					}),
				),
			),
		);
		for (const page of pages) {
			slugs.push(...page.data.map((product) => product.slug));
		}
	}

	return slugs;
}

function buildSitemap(
	siteUrl: string,
	categorySlugs: string[],
	brandSlugs: string[],
	productSlugs: string[],
): string {
	const urls = [
		...STATIC_PATHS.map((path) => (path === "/" ? `${siteUrl}/` : `${siteUrl}${path}`)),
		...categorySlugs.map((slug) => `${siteUrl}/categoria/${slug}`),
		...brandSlugs.map((slug) => `${siteUrl}/marca/${slug}`),
		...productSlugs.map((slug) => `${siteUrl}/producto/${slug}`),
	];

	const entries = urls
		.map((loc) => `\t<url>\n\t\t<loc>${escapeXml(loc)}</loc>\n\t</url>`)
		.join("\n");

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function sitemapResponse(body: string): Response {
	return new Response(body, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": SITEMAP_CACHE_CONTROL,
		},
	});
}

/**
 * In-process cache so a sitemap hit never fans out to ~11 API requests while
 * the HTTP cache policy is not in effect (see note above).
 */
const CACHE_TTL_MS = 60 * 60 * 1000;
let cachedSitemap: { body: string; expiresAt: number } | null = null;

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async () => {
				if (cachedSitemap && cachedSitemap.expiresAt > Date.now()) {
					return sitemapResponse(cachedSitemap.body);
				}

				const siteUrl = getSiteUrl().replace(/\/+$/, "");
				try {
					// The public product list response does not expose `updatedAt`,
					// so entries carry no <lastmod> (never fake freshness signals).
					const [tree, brands] = await Promise.all([
						unwrapResponse(api.api.v1.categories.get({ query: {} })),
						unwrapResponse(api.api.v1.brands.get({ query: {} })),
					]);

					const categorySlugs: string[] = [];
					collectCategorySlugs(tree, categorySlugs);

					const productSlugs = await fetchProductSlugs();
					const body = buildSitemap(
						siteUrl,
						categorySlugs,
						brands.map((brand) => brand.slug),
						productSlugs,
					);

					cachedSitemap = { body, expiresAt: Date.now() + CACHE_TTL_MS };
					return sitemapResponse(body);
				} catch (error) {
					console.error("[sitemap] Failed to build sitemap:", error);
					return new Response("Failed to build sitemap", { status: 500 });
				}
			},
		},
	},
});
