import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderPage } from "@/shared/components/layout/admin-placeholder-page";

function ProformasPage() {
	return <AdminPlaceholderPage title="Proformas" />;
}

export const Route = createFileRoute("/_authenticated/proformas")({
	component: ProformasPage,
});
