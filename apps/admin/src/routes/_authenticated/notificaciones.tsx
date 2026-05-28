import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderPage } from "@/shared/components/layout/admin-placeholder-page";

function NotificacionesPage() {
	return <AdminPlaceholderPage title="Notificaciones" />;
}

export const Route = createFileRoute("/_authenticated/notificaciones")({
	component: NotificacionesPage,
});
