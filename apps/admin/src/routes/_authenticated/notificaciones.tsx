import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderPage } from "@/shared/components/layout/admin-placeholder-page";

export const Route = createFileRoute("/_authenticated/notificaciones")({
	component: () => <AdminPlaceholderPage title="Notificaciones" />,
});
