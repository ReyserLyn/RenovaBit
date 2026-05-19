import openapi from "@elysiajs/openapi";
import { Elysia } from "elysia";
// import { OpenAPI } from "@/libs/auth/openapi";

export const DocsPlugin = new Elysia({ name: "docs" }).use(
	openapi({
		path: "/docs",
		enabled: process.env.NODE_ENV !== "production",
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
			// components: await OpenAPI.components,
			// paths: await OpenAPI.getPaths(),
		},
	}),
);
