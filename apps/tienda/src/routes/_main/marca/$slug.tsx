import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_main/marca/$slug")({
	component: RouteComponent,
});

function RouteComponent() {
	const { slug } = Route.useParams();

	return (
		<div className="flex flex-1 flex-col items-center justify-center p-4">
			<h1 className="text-2xl font-bold tracking-tight">Marca: {slug}</h1>
			<p className="text-muted-foreground mt-2">Próximamente — productos de esta marca</p>
		</div>
	);
}
