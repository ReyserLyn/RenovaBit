import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OrderDetailDialog } from "@/features/orders/components/order-detail-dialog";
import { OrderTable } from "@/features/orders/components/order-table";
import { ordersPaginatedQueryOptions } from "@/features/orders/hooks";
import { PageHeader } from "@/shared/components/layout/page-header";

function PedidosPage() {
	const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
	const [isDetailOpen, setIsDetailOpen] = useState(false);

	const handleViewDetail = (orderId: string) => {
		setSelectedOrderId(orderId);
		setIsDetailOpen(true);
	};

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Pedidos"
				description="Gestiona los pedidos de la tienda: cambia estados, revisa detalles y confirma órdenes."
			/>

			<OrderTable onViewDetail={handleViewDetail} />

			<OrderDetailDialog
				orderId={selectedOrderId}
				open={isDetailOpen}
				onOpenChange={setIsDetailOpen}
			/>
		</div>
	);
}

export const Route = createFileRoute("/_authenticated/pedidos")({
	loader: ({ context }) => {
		if (import.meta.env.SSR) return;
		return context.queryClient.ensureQueryData(
			ordersPaginatedQueryOptions({ page: 0, pageSize: 10 }),
		);
	},
	component: PedidosPage,
});
