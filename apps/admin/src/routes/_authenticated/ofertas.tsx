import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderPage } from "@/shared/components/layout/admin-placeholder-page";

function OfertasPage() {
	return <AdminPlaceholderPage title="Ofertas" />;
}

export const Route = createFileRoute("/_authenticated/ofertas")({
	component: OfertasPage,
});
