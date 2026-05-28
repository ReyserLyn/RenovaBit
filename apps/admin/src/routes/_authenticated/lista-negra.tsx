import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderPage } from "@/shared/components/layout/admin-placeholder-page";

function ListaNegraPage() {
	return <AdminPlaceholderPage title="SKUs bloqueados" />;
}

export const Route = createFileRoute("/_authenticated/lista-negra")({
	component: ListaNegraPage,
});
