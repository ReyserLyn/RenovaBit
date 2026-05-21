import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderPage } from "@/shared/components/layout/admin-placeholder-page";

export const Route = createFileRoute("/_authenticated/productos-destacados")({
	component: () => <AdminPlaceholderPage title="Productos destacados" />,
});
