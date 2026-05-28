import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderPage } from "@/shared/components/layout/admin-placeholder-page";

function ProductosDestacadosPage() {
	return <AdminPlaceholderPage title="Productos destacados" />;
}

export const Route = createFileRoute("/_authenticated/productos-destacados")({
	component: ProductosDestacadosPage,
});
