import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/registrarse")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center p-4">
			<div className="w-full max-w-md">
				<p className="text-center text-muted-foreground">Registro — próximamente</p>
			</div>
		</div>
	);
}
