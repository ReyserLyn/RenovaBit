import { createFileRoute } from "@tanstack/react-router";
import { getSiteUrl } from "@/shared/lib/env";

const SITEMAP = `${getSiteUrl()}/sitemap.xml`;
const BODY = `User-agent: *\nAllow: /\nSitemap: ${SITEMAP}`;

export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: () =>
				new Response(BODY, {
					headers: { "Content-Type": "text/plain" },
				}),
		},
	},
});
