import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderPage } from "@/shared/components/layout/admin-placeholder-page";

export const Route = createFileRoute("/_authenticated/reportes")({
	component: () => <AdminPlaceholderPage title="Ventas e informes" />,
});
