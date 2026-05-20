import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
	component: Home,
});

function Home() {
	return (
		<div className="flex flex-col h-full items-center justify-center p-6">
			<div className="w-full max-w-2xl text-center">
				<h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Renovabit Admin</h1>
				<p className="mt-4 text-lg text-muted-foreground">
					Panel de administración para gestionar tu catálogo de productos, marcas y categorías.
				</p>

				<div className="mt-10 grid gap-6 sm:grid-cols-3">
					<Card title="Marcas" description="Gestiona las marcas de tu catálogo." />
					<Card title="Categorías" description="Organiza productos por categorías." />
					<Card title="Productos" description="Administra tu inventario completo." />
				</div>
			</div>
		</div>
	);
}

function Card({ title, description }: { title: string; description: string }) {
	return (
		<div className="rounded-xl border bg-card p-6 shadow-sm transition hover:shadow-md">
			<h3 className="text-lg font-semibold">{title}</h3>
			<p className="mt-2 text-sm text-muted-foreground">{description}</p>
		</div>
	);
}
