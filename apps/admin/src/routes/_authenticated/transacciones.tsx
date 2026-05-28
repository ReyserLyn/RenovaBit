import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderPage } from "@/shared/components/layout/admin-placeholder-page";

function TransaccionesPage() {
	return <AdminPlaceholderPage title="Transacciones" />;
}

export const Route = createFileRoute("/_authenticated/transacciones")({
	component: TransaccionesPage,
});
