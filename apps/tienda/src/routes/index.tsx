import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/lib/seo";

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			...seo({
				title: "Renovabit · Tienda oficial de repuestos y accesorios",
				description:
					"Encuentra repuestos, accesorios y equipos para tu negocio. Envíos a todo Perú.",
			}),
		],
	}),
	component: HomePage,
});

function HomePage() {
	return (
		<main className="container mx-auto flex min-h-svh flex-col items-center justify-center p-4">
			<h1 className="text-4xl font-bold tracking-tight">Renovabit</h1>
			<p className="text-muted-foreground mt-2 text-lg">Tienda oficial — próximamente</p>
		</main>
	);
}
