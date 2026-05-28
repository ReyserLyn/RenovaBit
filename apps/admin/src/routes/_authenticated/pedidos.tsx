import { createFileRoute } from "@tanstack/react-router";
import { AdminPlaceholderPage } from "@/shared/components/layout/admin-placeholder-page";

function PedidosPage() {
	return <AdminPlaceholderPage title="Pedidos" />;
}

export const Route = createFileRoute("/_authenticated/pedidos")({
	component: PedidosPage,
});
