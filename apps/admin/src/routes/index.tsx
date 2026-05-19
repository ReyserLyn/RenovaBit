import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: Home,
});

function Home() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
			<div className="w-full max-w-2xl text-center">
				<h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
					Renovabit Admin
				</h1>
				<p className="mt-4 text-lg text-gray-600">
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
		<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md">
			<h3 className="text-lg font-semibold text-gray-900">{title}</h3>
			<p className="mt-2 text-sm text-gray-500">{description}</p>
		</div>
	);
}
