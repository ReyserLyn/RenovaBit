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
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { orderQueries } from "@/features/orders/hooks/queries";
import { getOrderListServerFn } from "@/features/orders/hooks/server";
import { getOrderStatusInfo } from "@/features/orders/lib/order-status";
import { Breadcrumbs } from "@/shared/components/breadcrumbs";
import { InfiniteScrollSentinel } from "@/shared/components/infinite-scroll-sentinel";
import { authSessionQueryOptions } from "@/shared/lib/auth/auth-session";
import { formatPrice } from "@/shared/lib/format";

const PAGE_SIZE = 10;

export const Route = createFileRoute("/_main/mis-pedidos/")({
	loader: async ({ context: { queryClient } }) => {
		const session = await queryClient.fetchQuery(authSessionQueryOptions());
		if (!session?.user) {
			throw redirect({ to: "/iniciar-sesion" });
		}

		const result = await getOrderListServerFn({ data: { page: 0, pageSize: PAGE_SIZE } });
		if (result.errorCode === "INVALID_CREDENTIALS") {
			throw redirect({ to: "/iniciar-sesion" });
		}

		return { firstPage: result.data ?? undefined };
	},
	component: OrdersPage,
});

const ORDER_LIST_DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", {
	year: "numeric",
	month: "long",
	day: "numeric",
});

function OrdersPage() {
	const { firstPage } = Route.useLoaderData();

	if (!firstPage) {
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

	const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } = useInfiniteQuery({
		...orderQueries.infiniteList(),
		initialData: { pages: [firstPage], pageParams: [0] },
	});

	const orders = data.pages.flatMap((page) => page.orders);
	const total = data.pages[0]?.total ?? 0;

	if (orders.length === 0) {
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

	return (
		<div className="flex flex-1 flex-col gap-6 py-6">
			<Breadcrumbs items={[{ name: "Mis pedidos" }]} />

			<div className="flex items-end justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight">Mis pedidos</h1>
					<p className="text-muted-foreground text-sm">
						{total === 1 ? "1 pedido en total" : `${total} pedidos en total`}
					</p>
				</div>
			</div>

			<ItemGroup>
				{orders.map((order) => {
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

			<InfiniteScrollSentinel
				hasNextPage={hasNextPage}
				isFetching={isFetching}
				isFetchingNextPage={isFetchingNextPage}
				fetchNextPage={fetchNextPage}
			/>
		</div>
	);
}
