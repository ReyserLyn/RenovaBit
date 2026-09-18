import openapi from "@elysiajs/openapi";
import { Elysia } from "elysia";

const isProduction = process.env.NODE_ENV === "production";

/**
 * API docs are a development-only surface.
 *
 * The Better Auth OpenAPI registry only exists when the auth `openAPI` plugin
 * is registered (it is not in production), so the docs plugin is built lazily
 * and never evaluated in production — importing it there used to crash the API
 * at boot with `generateOpenAPISchema is not a function`.
 */
async function createDocsPlugin() {
	const { OpenAPI } = await import("@/utils/auth/openapi");
	const components = await OpenAPI.components;
	const paths = await OpenAPI.getPaths();

	return new Elysia({ name: "docs" }).use(
		openapi({
			path: "/docs",
			documentation: {
				info: {
					title: "RenovaBit",
					version: "1.0.0",
					description: `Documentation for RenovaBit`,
					contact: {
						name: "Renovabit",
						url: "https://renovabit.com",
						email: "contacto@renovabit.com",
					},
				},
				components,
				paths,
			},
		}),
	);
}

export const DocsPlugin = isProduction ? new Elysia({ name: "docs" }) : await createDocsPlugin();
