import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_main/mis-pedidos")({
	// Applies to the layout and every child route (list, order detail).
	head: () => ({
		meta: [{ name: "robots", content: "noindex, follow" }],
	}),
	component: MisPedidosLayout,
});

function MisPedidosLayout() {
	return <Outlet />;
}
