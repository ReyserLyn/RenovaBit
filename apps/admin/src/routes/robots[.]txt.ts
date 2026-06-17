import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: () =>
				new Response("User-agent: *\nDisallow: /", {
					headers: { "Content-Type": "text/plain" },
				}),
		},
	},
});
