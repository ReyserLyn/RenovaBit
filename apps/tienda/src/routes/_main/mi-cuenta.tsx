import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_main/mi-cuenta")({
	component: () => (
		<div className="flex flex-1 flex-col items-center justify-center p-4">
			<p className="text-muted-foreground text-sm">Mi perfil — próximamente</p>
		</div>
	),
});
