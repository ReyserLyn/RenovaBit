import { createFileRoute } from "@tanstack/react-router";
import { getSiteUrl } from "@/shared/lib/env";

const SITEMAP = `${getSiteUrl()}/sitemap.xml`;

// Keep this list in sync with the private, noindex routes.
const DISALLOW = [
	"/carrito",
	"/mi-cuenta",
	"/mis-pedidos",
	"/iniciar-sesion",
	"/registrarse",
	"/favoritos",
	"/buscar",
	"/arma-tu-pc",
];

const BODY = [
	"User-agent: *",
	"Allow: /",
	...DISALLOW.map((path) => `Disallow: ${path}`),
	`Sitemap: ${SITEMAP}`,
	"",
].join("\n");

export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: () =>
				new Response(BODY, {
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				}),
		},
	},
});
