// @ts-check

import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import icon from "astro-icon";

export default defineConfig({
	site: "https://renovabit.com",
	server: { port: 3000 },
	integrations: [icon(), sitemap({})],
	vite: {
		plugins: [tailwindcss()],
	},
	fonts: [
		{
			provider: fontProviders.local(),
			name: "Outfit",
			cssVariable: "--font-outfit",
			options: {
				variants: [
					{
						src: ["./src/assets/fonts/outfit-v15-latin-300.woff2"],
						weight: "300",
						style: "normal",
					},
					{
						src: ["./src/assets/fonts/outfit-v15-latin-400.woff2"],
						weight: "400",
						style: "normal",
					},
					{
						src: ["./src/assets/fonts/outfit-v15-latin-500.woff2"],
						weight: "500",
						style: "normal",
					},
					{
						src: ["./src/assets/fonts/outfit-v15-latin-600.woff2"],
						weight: "600",
						style: "normal",
					},
					{
						src: ["./src/assets/fonts/outfit-v15-latin-700.woff2"],
						weight: "700",
						style: "normal",
					},
				],
			},
		},
	],
});
