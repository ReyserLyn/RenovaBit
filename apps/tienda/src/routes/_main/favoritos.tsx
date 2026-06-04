import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_main/favoritos")({
	component: () => (
		<div className="flex flex-1 flex-col items-center justify-center p-4">
			<p className="text-muted-foreground text-sm">Favoritos — próximamente</p>
		</div>
	),
});
