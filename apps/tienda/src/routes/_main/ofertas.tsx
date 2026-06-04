import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_main/ofertas")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/ofertas"!</div>;
}
