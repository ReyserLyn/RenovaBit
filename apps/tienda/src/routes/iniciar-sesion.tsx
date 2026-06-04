import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/iniciar-sesion")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/iniciar-sesion"!</div>;
}
