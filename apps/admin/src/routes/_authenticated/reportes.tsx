import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderPage } from "@/shared/components/layout/admin-placeholder-page";

function ReportesPage() {
	return <AdminPlaceholderPage title="Ventas e informes" />;
}

export const Route = createFileRoute("/_authenticated/reportes")({
	component: ReportesPage,
});
