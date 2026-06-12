import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import { Card, CardContent } from "@renovabit/ui/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { orderQueries } from "@/features/orders/hooks/queries";
import { Breadcrumbs } from "@/shared/components/breadcrumbs";
import { isApiClientError } from "@/shared/lib/api";
import { formatPrice } from "@/shared/lib/format";

export const Route = createFileRoute("/_main/mis-pedidos")({
	component: OrdersPage,
});

const PAGE_SIZE = 10;

const statusConfig: Record<
	string,
	{ label: string; variant: "warning" | "success" | "destructive" | "info" }
> = {
	pending: { label: "Pendiente", variant: "warning" },
	confirmed: { label: "Confirmado", variant: "success" },
	cancelled: { label: "Cancelado", variant: "destructive" },
	refunded: { label: "Reembolsado", variant: "info" },
};

function OrdersPage() {
	const [page, setPage] = useState(0);
	const { data, isLoading, error } = useQuery(orderQueries.list(page, PAGE_SIZE));

	if (error) {
		const isUnauthorized = isApiClientError(error) && error.code === "INVALID_CREDENTIALS";
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-4 py-12">
				<p className="text-muted-foreground">
					{isUnauthorized ? "Inicia sesión para ver tus pedidos" : "Error al cargar pedidos"}
				</p>
				<Button
					variant="outline"
					nativeButton={false}
					render={<Link to={isUnauthorized ? "/iniciar-sesion" : "/"} />}
				>
					{isUnauthorized ? "Iniciar sesión" : "Volver al inicio"}
				</Button>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex flex-1 flex-col gap-4 py-6">
				<h1 className="text-2xl font-bold tracking-tight">Mis pedidos</h1>
				{[1, 2, 3].map((i) => (
					<Card key={i}>
						<CardContent className="p-4">
							<div className="h-16 animate-pulse space-y-2">
								<div className="h-4 w-1/3 rounded bg-muted" />
								<div className="h-3 w-1/4 rounded bg-muted" />
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		);
	}

	if (!data || data.orders.length === 0) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-4 py-12">
				<h1 className="text-2xl font-bold tracking-tight">Mis pedidos</h1>
				<p className="text-muted-foreground text-sm">Aún no tienes pedidos.</p>
				<Button nativeButton={false} render={<Link to="/" />}>
					Ver productos
				</Button>
			</div>
		);
	}

	const totalPages = Math.ceil(data.total / PAGE_SIZE);

	return (
		<div className="flex flex-1 flex-col gap-6 py-6">
			<Breadcrumbs items={[{ name: "Mis pedidos" }]} />

			<h1 className="text-2xl font-bold tracking-tight">Mis pedidos</h1>

			<div className="flex flex-col gap-3">
				{data.orders.map((order) => {
					const statusInfo = statusConfig[order.status] ?? {
						label: order.status,
						variant: "info" as const,
					};
					return (
						<Card key={order.id}>
							<CardContent className="p-4">
								<div className="flex items-center justify-between gap-4">
									<div className="min-w-0 flex-1 space-y-1">
										<p className="truncate font-medium">{order.orderNumber}</p>
										<div className="flex items-center gap-3 text-xs text-muted-foreground">
											<span>
												{order.itemsCount} {order.itemsCount === 1 ? "producto" : "productos"}
											</span>
											<span>
												{new Date(order.createdAt).toLocaleDateString("es-PE", {
													year: "numeric",
													month: "long",
													day: "numeric",
												})}
											</span>
										</div>
									</div>
									<div className="flex items-center gap-3">
										<span className="text-sm font-semibold tabular-nums">
											{formatPrice(order.total)}
										</span>
										<Badge variant={statusInfo.variant} size="sm" radius="full">
											{statusInfo.label}
										</Badge>
									</div>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>

			{/* Pagination */}
			{totalPages > 1 && (
				<div className="flex items-center justify-center gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={page === 0}
						onClick={() => setPage((p) => p - 1)}
					>
						Anterior
					</Button>
					<span className="text-xs text-muted-foreground">
						Página {page + 1} de {totalPages}
					</span>
					<Button
						variant="outline"
						size="sm"
						disabled={page >= totalPages - 1}
						onClick={() => setPage((p) => p + 1)}
					>
						Siguiente
					</Button>
				</div>
			)}
		</div>
	);
}
