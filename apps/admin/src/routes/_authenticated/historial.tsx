import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderPage } from "@/shared/components/layout/admin-placeholder-page";

function HistorialPage() {
	return <AdminPlaceholderPage title="Historial" />;
}

export const Route = createFileRoute("/_authenticated/historial")({
	component: HistorialPage,
});
