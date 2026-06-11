import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/lib/seo";

type BuscarSearch = {
	q: string;
};

export const Route = createFileRoute("/_main/buscar")({
	validateSearch: (search: Record<string, unknown>): BuscarSearch => ({
		q: typeof search.q === "string" ? search.q : "",
	}),

	head: () => ({
		meta: [
			...seo({
				title: "Buscar productos · Renovabit",
				description: "Encuentra componentes de PC en Renovabit.",
			}),
		],
	}),

	component: BuscarPage,
});

function BuscarPage() {
	const { q } = Route.useSearch();

	return (
		<div className="flex flex-1 flex-col items-center justify-center p-4">
			{q ? (
				<>
					<h1 className="text-2xl font-bold tracking-tight">Resultados para: {q}</h1>
					<p className="text-muted-foreground mt-2">Próximamente — listado de productos</p>
				</>
			) : (
				<>
					<h1 className="text-2xl font-bold tracking-tight">Buscar productos</h1>
					<p className="text-muted-foreground mt-2">Ingresa un término de búsqueda</p>
				</>
			)}
		</div>
	);
}
