import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const staticAssetRule = (cacheControl: string) => ({
	headers: { "cache-control": cacheControl, vary: "accept-encoding" },
});

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		nitro({
			preset: "bun",
			routeRules: {
				// Content-hashed Vite output: same immutable policy as the plugin default.
				"/assets/**": staticAssetRule("public, max-age=31536000, immutable"),
				"/fonts/**": staticAssetRule("public, max-age=604800"),
				"/images/**": staticAssetRule("public, max-age=604800"),
				"/logo*.svg": staticAssetRule("public, max-age=604800"),
				"/favicon.ico": staticAssetRule("public, max-age=604800"),
				"/og-default.png": staticAssetRule("public, max-age=604800"),
				"/apple-touch-icon.png": staticAssetRule("public, max-age=604800"),
				// Crawler endpoints are public: their own handler headers would be
				// overridden by the SSR catch-all, so they need a specific route rule.
				// `vary: accept-encoding` also replaces the catch-all `vary: cookie`
				// so shared caches can store them.
				"/sitemap.xml": staticAssetRule("public, max-age=3600, s-maxage=86400"),
				"/robots.txt": staticAssetRule("public, max-age=3600"),
				// SSR HTML embeds session/cart state: never let shared caches reuse it.
				"/**": { headers: { "cache-control": "private, no-cache", vary: "cookie" } },
			},
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
});

export default config;
