import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_main/mis-pedidos")({
	component: MisPedidosLayout,
});

function MisPedidosLayout() {
	return <Outlet />;
}
