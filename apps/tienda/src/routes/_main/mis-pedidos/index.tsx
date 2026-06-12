import { ArrowRight01Icon, ShoppingBag01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
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
import { useRef } from "react";
import { ORDER_STATUS_UI, orderQueries, statusUiToApi } from "@/features/orders/hooks/queries";
import { getOrderListServerFn } from "@/features/orders/hooks/server";
import { getOrderStatusInfo } from "@/features/orders/lib/order-status";
import { Breadcrumbs } from "@/shared/components/breadcrumbs";
import { InfiniteScrollSentinel } from "@/shared/components/infinite-scroll-sentinel";
import { authSessionQueryOptions } from "@/shared/lib/auth/auth-session";
import { formatPrice } from "@/shared/lib/format";

const PAGE_SIZE = 10;

function isValidEstado(value: string): value is (typeof ORDER_STATUS_UI)[number] {
	return ORDER_STATUS_UI.some((s) => s === value);
}

export const Route = createFileRoute("/_main/mis-pedidos/")({
	validateSearch: (s: Record<string, unknown>) => {
		const estado = typeof s.estado === "string" && isValidEstado(s.estado) ? s.estado : undefined;
		return estado ? { estado } : {};
	},

	loaderDeps: ({ search }) => ({ estado: search.estado }),

	loader: async ({ deps, context: { queryClient }, location }) => {
		const rawParams = new URLSearchParams(location.searchStr);
		const rawEstado = rawParams.get("estado");
		if (rawEstado !== null && !isValidEstado(rawEstado)) {
			throw redirect({ to: ".", search: {}, replace: true });
		}

		const session = await queryClient.fetchQuery(authSessionQueryOptions());
		if (!session?.user) {
			throw redirect({ to: "/iniciar-sesion" });
		}

		const apiStatus = deps.estado ? statusUiToApi(deps.estado) : undefined;
		const result = await getOrderListServerFn({
			data: { page: 0, pageSize: PAGE_SIZE, status: apiStatus },
		});
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
	const { estado } = Route.useSearch();
	const navigate = Route.useNavigate();
	const lastTotal = useRef(0);

	const apiStatus = statusUiToApi(estado);
	const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } = useInfiniteQuery({
		...orderQueries.infiniteList(PAGE_SIZE, apiStatus),
		initialData: firstPage ? { pages: [firstPage], pageParams: [0] } : undefined,
	});

	const orders = data?.pages.flatMap((page) => page.orders) ?? [];
	const total = data?.pages[0]?.total ?? lastTotal.current;

	if (data?.pages[0]?.total !== undefined) {
		lastTotal.current = data.pages[0].total;
	}

	return (
		<div className="flex flex-1 flex-col gap-6 py-6">
			<Breadcrumbs items={[{ name: "Mis pedidos" }]} />

			<div className="flex items-end justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight">Mis pedidos</h1>
					<p className="text-muted-foreground text-sm">
						{total === 1 ? "1 pedido" : `${total} pedidos`}
						{estado && apiStatus && ` · ${getOrderStatusInfo(apiStatus).label.toLowerCase()}`}
					</p>
				</div>
			</div>

			<div className="flex flex-wrap gap-2">
				<Button
					variant={estado === undefined ? "default" : "outline"}
					size="sm"
					onClick={() => navigate({ to: ".", search: {}, replace: true })}
				>
					Todos
				</Button>
				{ORDER_STATUS_UI.map((v) => (
					<Button
						key={v}
						variant={estado === v ? "default" : "outline"}
						size="sm"
						onClick={() => navigate({ to: ".", search: { estado: v }, replace: true })}
					>
						{getOrderStatusInfo(statusUiToApi(v)!).label}
					</Button>
				))}
			</div>

			{orders.length === 0 && !isFetching && firstPage ? (
				<Empty className="flex-1 border-0 py-12">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<HugeiconsIcon icon={ShoppingBag01Icon} size={20} strokeWidth={1.5} />
						</EmptyMedia>
						<EmptyTitle>
							{estado && apiStatus
								? `No hay pedidos ${getOrderStatusInfo(apiStatus).label.toLowerCase()}`
								: "Aún no tienes pedidos"}
						</EmptyTitle>
						<EmptyDescription>
							{estado
								? "Cuando tengas pedidos en este estado, aparecerán aquí."
								: "Cuando hagas tu primera compra, aparecerá acá con su número, total y estado."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<>
					<ItemGroup>
						{orders.map((order) => {
							const status = getOrderStatusInfo(order.status);
							const itemsLabel = `${order.itemsCount} ${
								order.itemsCount === 1 ? "producto" : "productos"
							}`;
							return (
								<Item
									key={order.id}
									variant="muted"
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
				</>
			)}
		</div>
	);
}
