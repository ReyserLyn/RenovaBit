import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderPage } from "@/shared/components/layout/admin-placeholder-page";

function ClientesPage() {
	return <AdminPlaceholderPage title="Clientes" />;
}

export const Route = createFileRoute("/_authenticated/clientes")({
	component: ClientesPage,
});
