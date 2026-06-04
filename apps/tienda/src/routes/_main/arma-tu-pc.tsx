import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_main/arma-tu-pc")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/arma-tu-pc"!</div>;
}
