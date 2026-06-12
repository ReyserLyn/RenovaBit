import { ArrowRight01Icon, Package01Icon, ShoppingBag01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import { Card, CardContent } from "@renovabit/ui/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@renovabit/ui/components/ui/empty";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemGroup,
	ItemTitle,
} from "@renovabit/ui/components/ui/item";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { orderQueries } from "@/features/orders/hooks/queries";
import { getOrderStatusInfo } from "@/features/orders/lib/order-status";
import { Breadcrumbs } from "@/shared/components/breadcrumbs";
import { isApiClientError } from "@/shared/lib/api";
import { formatPrice } from "@/shared/lib/format";

export const Route = createFileRoute("/_main/mis-pedidos/")({
	component: OrdersPage,
});

const PAGE_SIZE = 10;
const ORDER_LIST_DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", {
	year: "numeric",
	month: "long",
	day: "numeric",
});

function OrderRowSkeleton() {
	return (
		<Card>
			<CardContent className="p-0">
				<div className="flex items-center gap-4 p-4">
					<Skeleton className="size-10 shrink-0 rounded-md" />
					<div className="min-w-0 flex-1 space-y-2">
						<Skeleton className="h-4 w-1/3" />
						<Skeleton className="h-3 w-1/2" />
					</div>
					<Skeleton className="h-6 w-20" />
				</div>
			</CardContent>
		</Card>
	);
}

function OrdersPage() {
	const [page, setPage] = useState(0);
	const { data, isLoading, isFetching, error } = useQuery({
		...orderQueries.list(page, PAGE_SIZE),
		placeholderData: keepPreviousData,
	});

	if (error && !isLoading) {
		const isUnauthorized = isApiClientError(error) && error.code === "INVALID_CREDENTIALS";
		if (isUnauthorized) {
			return (
				<div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
					<Empty className="border-0 p-0">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<HugeiconsIcon icon={Package01Icon} size={20} strokeWidth={1.5} />
							</EmptyMedia>
							<EmptyTitle>Inicia sesión para ver tus pedidos</EmptyTitle>
							<EmptyDescription>
								Necesitas una cuenta para consultar el historial de pedidos.
							</EmptyDescription>
						</EmptyHeader>
						<Button nativeButton={false} render={<Link to="/iniciar-sesion" />}>
							Iniciar sesión
						</Button>
					</Empty>
				</div>
			);
		}
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
				<Empty className="border-0 p-0">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<HugeiconsIcon icon={Package01Icon} size={20} strokeWidth={1.5} />
						</EmptyMedia>
						<EmptyTitle>No pudimos cargar tus pedidos</EmptyTitle>
						<EmptyDescription>
							Hubo un problema al consultar el servidor. Intenta de nuevo en unos minutos.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
				<Button variant="outline" nativeButton={false} render={<Link to="/" />}>
					Volver al inicio
				</Button>
			</div>
		);
	}

	if (isLoading && !data) {
		return (
			<div className="flex flex-1 flex-col gap-6 py-6">
				<Breadcrumbs items={[{ name: "Mis pedidos" }]} />
				<div className="flex items-end justify-between gap-4">
					<div className="space-y-2">
						<h1 className="text-2xl font-bold tracking-tight">Mis pedidos</h1>
						<p className="text-muted-foreground text-sm">Cargando...</p>
					</div>
				</div>
				<div className="flex flex-col gap-3">
					<OrderRowSkeleton />
					<OrderRowSkeleton />
					<OrderRowSkeleton />
				</div>
			</div>
		);
	}

	if (!data || data.orders.length === 0) {
		return (
			<div className="flex flex-1 flex-col py-6">
				<Breadcrumbs items={[{ name: "Mis pedidos" }]} />
				<Empty className="flex-1 border-0 py-12">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<HugeiconsIcon icon={ShoppingBag01Icon} size={20} strokeWidth={1.5} />
						</EmptyMedia>
						<EmptyTitle>Aún no tienes pedidos</EmptyTitle>
						<EmptyDescription>
							Cuando hagas tu primera compra, aparecerá acá con su número, total y estado.
						</EmptyDescription>
					</EmptyHeader>
					<Button nativeButton={false} render={<Link to="/" />}>
						Explorar productos
					</Button>
				</Empty>
			</div>
		);
	}

	const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

	return (
		<div className="flex flex-1 flex-col gap-6 py-6">
			<Breadcrumbs items={[{ name: "Mis pedidos" }]} />

			<div className="flex items-end justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight">Mis pedidos</h1>
					<p className="text-muted-foreground text-sm">
						{data.total === 1 ? "1 pedido en total" : `${data.total} pedidos en total`}
					</p>
				</div>
			</div>

			<ItemGroup>
				{data.orders.map((order) => {
					const status = getOrderStatusInfo(order.status);
					const itemsLabel = `${order.itemsCount} ${
						order.itemsCount === 1 ? "producto" : "productos"
					}`;
					return (
						<Item
							key={order.id}
							variant="outline"
							render={
								<Link
									to="/mis-pedidos/$id"
									params={{ id: order.id }}
									aria-label={`Ver detalle del pedido ${order.orderNumber}`}
								/>
							}
						>
							<ItemContent>
								<ItemTitle className="text-base font-semibold">{order.orderNumber}</ItemTitle>
								<p className="text-muted-foreground text-xs">
									{itemsLabel} · {ORDER_LIST_DATE_FORMATTER.format(new Date(order.createdAt))}
								</p>
							</ItemContent>
							<ItemActions className="gap-3">
								<span className="text-sm font-semibold tabular-nums">
									{formatPrice(order.total)}
								</span>
								<Badge variant={status.variant} size="sm" radius="full">
									{status.label}
								</Badge>
								<HugeiconsIcon
									icon={ArrowRight01Icon}
									size={16}
									className="text-muted-foreground"
								/>
							</ItemActions>
						</Item>
					);
				})}
			</ItemGroup>

			{totalPages > 1 && (
				<div className="flex items-center justify-center gap-3 pt-2">
					<Button
						variant="outline"
						size="sm"
						disabled={page === 0 || isFetching}
						onClick={() => setPage((p) => Math.max(0, p - 1))}
					>
						Anterior
					</Button>
					<span className="text-muted-foreground text-xs">
						Página {page + 1} de {totalPages}
						{isFetching ? " · Cargando..." : ""}
					</span>
					<Button
						variant="outline"
						size="sm"
						disabled={page >= totalPages - 1 || isFetching}
						onClick={() => setPage((p) => p + 1)}
					>
						Siguiente
					</Button>
				</div>
			)}
		</div>
	);
}
