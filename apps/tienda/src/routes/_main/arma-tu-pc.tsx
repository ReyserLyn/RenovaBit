import { createFileRoute } from "@tanstack/react-router";

// Private stub, intentionally unlinked and excluded from search engines.
export const Route = createFileRoute("/_main/arma-tu-pc")({
	head: () => ({
		meta: [{ name: "robots", content: "noindex, follow" }],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/arma-tu-pc"!</div>;
}
