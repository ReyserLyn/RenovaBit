import {
	ArrowLeft02Icon,
	Calendar01Icon,
	Cancel01Icon,
	Copy01Icon,
	InformationCircleIcon,
	NoteIcon,
	Package01Icon,
	UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AUTO_CANCEL_DAYS, AUTO_CANCEL_MS } from "@renovabit/db/constants";
import {
	Alert,
	AlertContent,
	AlertDescription,
	AlertIcon,
	AlertTitle,
} from "@renovabit/ui/components/ui/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@renovabit/ui/components/ui/alert-dialog";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@renovabit/ui/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@renovabit/ui/components/ui/empty";
import {
	Item,
	ItemContent,
	ItemGroup,
	ItemSeparator,
	ItemTitle,
} from "@renovabit/ui/components/ui/item";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useCancelOrder } from "@/features/orders/hooks/mutations";
import { orderQueries } from "@/features/orders/hooks/queries";
import { getOrderDetailServerFn } from "@/features/orders/hooks/server";
import {
	getOrderStatusInfo,
	getPaymentMethodLabel,
	getSourceLabel,
} from "@/features/orders/lib/order-status";
import { Breadcrumbs } from "@/shared/components/breadcrumbs";
import { WhatsAppIcon } from "@/shared/components/icons";
import { isApiClientError } from "@/shared/lib/api";
import { authSessionQueryOptions } from "@/shared/lib/auth/auth-session";
import { copyText } from "@/shared/lib/clipboard";
import { buildWhatsAppUrl, orderWhatsAppMessage } from "@/shared/lib/contact";
import { getSiteUrl } from "@/shared/lib/env";
import { formatPrice } from "@/shared/lib/format";

const ORDER_DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", {
	timeZone: "America/Lima",
	year: "numeric",
	month: "long",
	day: "numeric",
});

const ORDER_TIME_FORMATTER = new Intl.DateTimeFormat("es-PE", {
	timeZone: "America/Lima",
	hour: "2-digit",
	minute: "2-digit",
	hour12: true,
});

function formatOrderDateTime(value: string): string {
	const date = new Date(value);
	return `${ORDER_DATE_FORMATTER.format(date)}, ${ORDER_TIME_FORMATTER.format(date)}`;
}

export const Route = createFileRoute("/_main/mis-pedidos/$id")({
	loader: async ({ params, context: { queryClient } }) => {
		const session = await queryClient.fetchQuery(authSessionQueryOptions());
		if (!session?.user) {
			throw redirect({ to: "/iniciar-sesion" });
		}

		const result = await getOrderDetailServerFn({ data: { id: params.id } });
		if (result.order) {
			queryClient.setQueryData(orderQueries.detail(params.id).queryKey, result.order);
			return { order: result.order };
		}

		if (result.errorCode === "INVALID_CREDENTIALS") {
			throw redirect({ to: "/iniciar-sesion" });
		}

		if (result.errorCode === "NOT_FOUND_ERROR" || result.errorCode === "ACCESS_DENIED") {
			throw notFound();
		}

		return { order: undefined };
	},
	component: OrderDetailPage,
});

function OrderDetailPage() {
	const [copied, setCopied] = useState<"order" | "link" | null>(null);
	const { id } = Route.useParams();
	const { order: initialOrder } = Route.useLoaderData();
	const { data: order, error } = useQuery({
		...orderQueries.detail(id),
		initialData: initialOrder,
	});

	if (!order) {
		const code = isApiClientError(error) ? error.code : null;
		if (code === "INVALID_CREDENTIALS") {
			return (
				<ErrorState
					title="Inicia sesión para ver este pedido"
					description="Necesitas una cuenta para revisar el detalle de tus pedidos."
					ctaLabel="Iniciar sesión"
					ctaTo="/iniciar-sesion"
				/>
			);
		}
		return (
			<ErrorState
				title="No pudimos cargar el pedido"
				description="Hubo un problema al consultar el servidor. Intenta de nuevo en unos minutos."
				ctaLabel="Volver a mis pedidos"
				ctaTo="/mis-pedidos"
			/>
		);
	}

	const status = getOrderStatusInfo(order.status);
	const orderNumber = order.orderNumber;
	const itemsCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
	const orderDetailUrl = `${getSiteUrl()}/mis-pedidos/${order.id}`;
	const waMessage = orderWhatsAppMessage({
		orderNumber,
		total: formatPrice(order.total),
		customerName: order.customerName,
	});
	const waUrl = buildWhatsAppUrl({ message: waMessage });

	const canCancel =
		order.status === "pending" && Date.now() - new Date(order.createdAt).getTime() < AUTO_CANCEL_MS;
	const cancelOrder = useCancelOrder();
	const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

	function handleCopy(kind: "order" | "link") {
		const text = kind === "order" ? orderNumber : orderDetailUrl;
		const label = kind === "order" ? "Número de pedido" : "Enlace del pedido";
		copyText(text, {
			label,
			onSuccess: () => {
				setCopied(kind);
				setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1500);
			},
		});
	}

	return (
		<div className="flex flex-1 flex-col gap-6 py-6">
			<Breadcrumbs
				items={[{ name: "Mis pedidos", link: { to: "/mis-pedidos" } }, { name: order.orderNumber }]}
			/>

			{/* ── Header ───────────────────────────── */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{order.orderNumber}</h1>
						<Badge variant={status.variant} size="lg" radius="full">
							{status.label}
						</Badge>
					</div>
					<p className="text-muted-foreground text-sm">
						<HugeiconsIcon
							icon={Calendar01Icon}
							size={14}
							strokeWidth={1.5}
							className="mr-1 inline align-[-2px]"
						/>
						Realizado el {formatOrderDateTime(order.createdAt)}
					</p>
				</div>
				<div className="flex flex-wrap justify-end gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => handleCopy("order")}
						aria-label="Copiar número de pedido"
					>
						<HugeiconsIcon
							icon={Copy01Icon}
							size={16}
							className={copied === "order" ? "text-success" : ""}
						/>
						{copied === "order" ? "Copiado" : "Copiar número"}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => handleCopy("link")}
						aria-label="Copiar enlace del pedido"
					>
						<HugeiconsIcon
							icon={Copy01Icon}
							size={16}
							className={copied === "link" ? "text-success" : ""}
						/>
						{copied === "link" ? "Copiado" : "Copiar enlace"}
					</Button>
					<Button
						variant="outline"
						size="sm"
						nativeButton={false}
						render={<Link to="/mis-pedidos" />}
					>
						<HugeiconsIcon icon={ArrowLeft02Icon} size={16} />
						Volver
					</Button>
					{canCancel && (
						<AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
							<AlertDialogTrigger
								render={
									<Button
										variant="outline"
										size="sm"
										className="border-destructive/40 text-destructive"
									>
										<HugeiconsIcon icon={Cancel01Icon} size={16} />
										Cancelar pedido
									</Button>
								}
							/>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Cancelar pedido</AlertDialogTitle>
									<AlertDialogDescription>
										¿Estás seguro de que deseas cancelar el pedido <strong>{orderNumber}</strong>?
										Esta acción libera los productos reservados y no se puede deshacer.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Volverse</AlertDialogCancel>
									<AlertDialogAction
										className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
										onClick={() => cancelOrder.mutate(order.id)}
										disabled={cancelOrder.isPending}
									>
										{cancelOrder.isPending ? "Cancelando..." : "Sí, cancelar pedido"}
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					)}
				</div>
			</div>

			{/* ── Alertas de estado ────────────────── */}
			{order.status === "pending" && (
				<Alert appearance="light" variant="info" size="md">
					<AlertIcon>
						<HugeiconsIcon icon={InformationCircleIcon} size={18} strokeWidth={1.5} />
					</AlertIcon>
					<AlertContent>
						<AlertTitle>Pedido en revisión</AlertTitle>
						<AlertDescription>
							Tu pedido está pendiente de confirmación. Si no lo confirmamos en {AUTO_CANCEL_DAYS}{" "}
							días, se cancelará automáticamente.
						</AlertDescription>
					</AlertContent>
				</Alert>
			)}
			{order.status === "cancelled" && order.cancelReason && (
				<Alert appearance="light" variant="destructive" size="md">
					<AlertIcon>
						<HugeiconsIcon icon={NoteIcon} size={18} strokeWidth={1.5} />
					</AlertIcon>
					<AlertContent>
						<AlertTitle>Pedido cancelado</AlertTitle>
						<AlertDescription>{order.cancelReason}</AlertDescription>
					</AlertContent>
				</Alert>
			)}

			{/* ── Resumen ──────────────────────────── */}
			<Card>
				<CardHeader>
					<CardTitle>Resumen del pedido</CardTitle>
					<CardDescription>
						{itemsCount === 1 ? "1 producto" : `${itemsCount} productos`} ·{" "}
						{getPaymentMethodLabel(order.paymentMethod)}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<SummaryRow label="Subtotal" value={formatPrice(order.subtotal)} />
					{order.discountTotal !== "0.00" && Number(order.discountTotal) > 0 && (
						<SummaryRow label="Descuento" value={`- ${formatPrice(order.discountTotal)}`} />
					)}
					<div className="flex items-baseline justify-between border-t pt-3 text-base font-semibold">
						<span>Total</span>
						<span className="tabular-nums">{formatPrice(order.total)}</span>
					</div>
				</CardContent>
			</Card>

			{/* ── Productos ────────────────────────── */}
			<Card>
				<CardHeader>
					<CardTitle>Productos</CardTitle>
					<CardDescription>Detalle de los {itemsCount} artículos de tu pedido</CardDescription>
				</CardHeader>
				<CardContent className="p-0">
					<ItemGroup className="gap-0 px-4 pb-2">
						{order.items.map((item, index) => (
							<div key={item.id}>
								{index > 0 && <ItemSeparator />}
								<Item variant="default" size="sm" className="border-0 px-0 py-3">
									<ItemContent>
										<ItemTitle className="text-sm font-medium">{item.productName}</ItemTitle>
										<p className="text-muted-foreground text-xs">SKU: {item.productSku}</p>
									</ItemContent>
									<div className="flex shrink-0 items-center gap-3 text-right">
										<div className="text-muted-foreground text-xs">
											{item.quantity} × {formatPrice(item.unitPrice)}
										</div>
										<div className="text-sm font-semibold tabular-nums">
											{formatPrice(item.finalPrice)}
										</div>
									</div>
								</Item>
							</div>
						))}
					</ItemGroup>
				</CardContent>
			</Card>

			{/* ── Información adicional ────────────── */}
			{(order.customerName || order.customerPhone || order.notes || order.adminNotes) && (
				<Card>
					<CardHeader>
						<CardTitle>Información adicional</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-sm">
						{(order.customerName || order.customerPhone) && (
							<div className="space-y-1">
								<p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
									<HugeiconsIcon icon={UserIcon} size={14} strokeWidth={1.5} />
									Datos de contacto
								</p>
								{order.customerName && <p>{order.customerName}</p>}
								{order.customerPhone && (
									<p className="text-muted-foreground">{order.customerPhone}</p>
								)}
							</div>
						)}
						{order.notes && (
							<div className="space-y-1">
								<p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
									<HugeiconsIcon icon={NoteIcon} size={14} strokeWidth={1.5} />
									Tus notas
								</p>
								<p className="whitespace-pre-wrap">{order.notes}</p>
							</div>
						)}
						{order.adminNotes && (
							<div className="space-y-1">
								<p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
									<HugeiconsIcon icon={NoteIcon} size={14} strokeWidth={1.5} />
									Notas del equipo
								</p>
								<p className="whitespace-pre-wrap">{order.adminNotes}</p>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* ── Origen (info pequeña) ────────────── */}
			<p className="text-muted-foreground text-center text-xs">
				Pedido creado desde {getSourceLabel(order.source)}
			</p>

			{/* ── CTAs ────────────────────────────── */}
			<div className="grid gap-3 sm:grid-cols-2">
				<Button
					nativeButton={false}
					size="lg"
					className="border-[#25D366] bg-[#25D366] text-white hover:bg-[#25D366]/90 hover:text-white"
					render={
						<a href={waUrl} target="_blank" rel="noopener noreferrer">
							<WhatsAppIcon className="size-5" />
							Hablar por WhatsApp
						</a>
					}
				/>
				<Button
					variant="outline"
					size="lg"
					nativeButton={false}
					render={
						<a
							href={buildWhatsAppUrl({
								message: `Hola, necesito ayuda con mi pedido ${order.orderNumber}`,
							})}
							target="_blank"
							rel="noopener noreferrer"
						>
							<WhatsAppIcon className="size-5" />
							Otra consulta
						</a>
					}
				/>
			</div>
		</div>
	);
}

function SummaryRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-baseline justify-between">
			<span className="text-muted-foreground">{label}</span>
			<span className="tabular-nums">{value}</span>
		</div>
	);
}

interface ErrorStateProps {
	title: string;
	description: string;
	ctaLabel: string;
	ctaTo: string;
}

function ErrorState({ title, description, ctaLabel, ctaTo }: ErrorStateProps) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center py-12">
			<Empty className="border-0">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<HugeiconsIcon icon={Package01Icon} size={20} strokeWidth={1.5} />
					</EmptyMedia>
					<EmptyTitle>{title}</EmptyTitle>
					<EmptyDescription>{description}</EmptyDescription>
				</EmptyHeader>
				<Button nativeButton={false} render={<Link to={ctaTo} />}>
					{ctaLabel}
				</Button>
			</Empty>
		</div>
	);
}
