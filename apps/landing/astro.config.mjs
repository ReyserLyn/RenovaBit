// @ts-check

import preact from "@astrojs/preact";
import { defineConfig } from "astro/config";

export default defineConfig({
	server: { port: 3000 },
	integrations: [preact()],
});
