import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderPage } from "@/shared/components/layout/admin-placeholder-page";

function ConfiguracionPage() {
	return <AdminPlaceholderPage title="Configuración" />;
}

export const Route = createFileRoute("/_authenticated/configuracion")({
	component: ConfiguracionPage,
});
