import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_main/carrito")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center p-4">
			<h1 className="text-2xl font-bold tracking-tight">Carrito</h1>
			<p className="text-muted-foreground mt-2">Próximamente — tu carrito de compras</p>
		</div>
	);
}
