import { Button } from "@renovabit/ui/components/ui/button";
import { Input } from "@renovabit/ui/components/ui/input";
import { Label } from "@renovabit/ui/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@renovabit/ui/components/ui/select";
import { Separator } from "@renovabit/ui/components/ui/separator";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import { Textarea } from "@renovabit/ui/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { CartItem } from "@/features/cart/components/cart-item";
import { cartQueries } from "@/features/cart/hooks/queries";
import { getCartServerFn } from "@/features/cart/hooks/server";
import { summarizeAvailableCartItems } from "@/features/cart/lib/summary";
import { OrderSuccessPanel } from "@/features/orders/components/order-success-panel";
import { useCreateOrder } from "@/features/orders/hooks/mutations";
import { PAYMENT_METHOD_OPTIONS, type PaymentMethod } from "@/features/orders/lib/payment-methods";
import { authSessionQueryOptions } from "@/shared/lib/auth/auth-session";
import { formatPrice } from "@/shared/lib/format";
import { useCartGuestStore } from "@/shared/lib/stores/cart";

export const Route = createFileRoute("/_main/carrito")({
	loader: async ({ context: { queryClient } }) => {
		const session = await queryClient.fetchQuery(authSessionQueryOptions());
		let cart = null;
		if (session?.user) {
			cart = await getCartServerFn();
		}
		return { preloadedSession: session, preloadedCart: cart };
	},
	component: CartPage,
});

function CartPage() {
	const { preloadedSession, preloadedCart } = Route.useLoaderData();
	const guestToken = useCartGuestStore((s) => s.guestToken);
	const setGuestToken = useCartGuestStore((s) => s.setGuestToken);
	const [mounted, setMounted] = useState(false);
	const { data: session } = useQuery({
		...authSessionQueryOptions(),
		initialData: preloadedSession,
	});
	const isLoggedIn = !!session?.user;
	const activeGuestToken = isLoggedIn ? null : guestToken;
	const { data: cart, isLoading } = useQuery({
		...cartQueries.detail(activeGuestToken),
		enabled: isLoggedIn || (mounted && !!activeGuestToken),
		initialData: preloadedCart ?? undefined,
	});
	const createOrder = useCreateOrder();

	const [customerName, setCustomerName] = useState("");
	const [customerPhone, setCustomerPhone] = useState("");
	const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
	const [notes, setNotes] = useState("");
	const [completedOrder, setCompletedOrder] = useState<{
		id: string;
		orderNumber: string;
		total: string;
		customerName?: string | null;
	} | null>(null);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!cart?.guestToken) return;
		if (cart.guestToken !== guestToken) {
			setGuestToken(cart.guestToken);
		}
	}, [cart?.guestToken, guestToken, setGuestToken]);

	const { availableItems, availableItemsCount, availableSubtotal, hasUnavailableItems } =
		summarizeAvailableCartItems(cart?.items ?? []);

	if ((!isLoggedIn && !mounted) || isLoading) {
		return (
			<div className="flex flex-1 flex-col gap-8 py-6">
				<Skeleton className="h-8 w-48" />
				<div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
					<div className="flex-1 space-y-4">
						{[1, 2, 3].map((i) => (
							<div key={i} className="flex gap-3">
								<Skeleton className="size-16 shrink-0 rounded-lg" />
								<div className="flex-1 space-y-2">
									<Skeleton className="h-4 w-3/4" />
									<Skeleton className="h-3 w-1/2" />
									<Skeleton className="h-6 w-24" />
								</div>
							</div>
						))}
					</div>
					<div className="w-full space-y-6 lg:w-80">
						<Skeleton className="h-8 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-20 w-full" />
						<Skeleton className="h-12 w-full" />
					</div>
				</div>
			</div>
		);
	}

	if (completedOrder) {
		return <OrderSuccessPanel order={completedOrder} isLoggedIn={isLoggedIn} />;
	}

	if (!cart || cart.items.length === 0) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-4 py-12">
				<h1 className="text-2xl font-bold tracking-tight">Tu carrito está vacío</h1>
				<p className="text-muted-foreground text-sm">
					Explora nuestros productos y añade los que más te gusten.
				</p>
				<Button nativeButton={false} render={<Link to="/" />}>
					Ver productos
				</Button>
			</div>
		);
	}

	const handleSubmit = (event?: FormEvent) => {
		event?.preventDefault();
		if (!isLoggedIn && !customerName.trim()) return;

		createOrder.mutate(
			{
				cartId: cart.id,
				guestToken: isLoggedIn ? undefined : (activeGuestToken ?? undefined),
				customerName: isLoggedIn ? null : customerName.trim(),
				customerPhone: isLoggedIn ? null : customerPhone.trim() || null,
				notes: notes.trim() || null,
				paymentMethod: paymentMethod ?? null,
			},
			{
				onSuccess: (order) =>
					setCompletedOrder({
						id: order.id,
						orderNumber: order.orderNumber,
						total: order.total,
						customerName: order.customerName ?? null,
					}),
			},
		);
	};

	return (
		<div className="flex flex-1 flex-col gap-8 py-6">
			<h1 className="text-2xl font-bold tracking-tight">Carrito de compras</h1>

			{hasUnavailableItems && (
				<div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
					Hay productos no disponibles en tu carrito. Retíralos o actualiza cantidades para poder
					crear el pedido.
				</div>
			)}

			<div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
				{/* Items */}
				<div className="flex-1 space-y-4">
					{cart.items.map((item) => (
						<CartItem key={item.id} item={item} />
					))}
				</div>

				{/* Checkout Sidebar */}
				<form className="w-full shrink-0 space-y-6 lg:w-80" onSubmit={handleSubmit}>
					{/* Contact Info (guest only) */}
					{!isLoggedIn && (
						<div className="space-y-3">
							<h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
								Tus datos
							</h2>
							<div className="space-y-1.5">
								<Label htmlFor="checkout-name">Nombre *</Label>
								<Input
									id="checkout-name"
									value={customerName}
									onChange={(e) => setCustomerName(e.target.value)}
									placeholder="Tu nombre"
									autoComplete="name"
									required
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="checkout-phone">Teléfono</Label>
								<Input
									id="checkout-phone"
									value={customerPhone}
									onChange={(e) => setCustomerPhone(e.target.value)}
									placeholder="999 999 999"
									type="tel"
									autoComplete="tel"
									inputMode="tel"
								/>
							</div>
						</div>
					)}

					{/* Payment Method */}
					<div className="space-y-3">
						<h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
							Método de pago
						</h2>
						<Select
							items={PAYMENT_METHOD_OPTIONS}
							value={paymentMethod}
							onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Seleccionar método" />
							</SelectTrigger>
							<SelectContent>
								{PAYMENT_METHOD_OPTIONS.map((method) => (
									<SelectItem key={method.value} value={method.value}>
										{method.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Notes */}
					<div className="space-y-3">
						<h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
							Notas
						</h2>
						<Textarea
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Alguna indicación para tu pedido..."
							rows={3}
						/>
					</div>

					<Separator />

					{/* Summary */}
					<div className="space-y-2 text-sm">
						<div className="flex justify-between">
							<span className="text-muted-foreground">Productos ({availableItemsCount})</span>
							<span>{formatPrice(availableSubtotal)}</span>
						</div>
						<div className="flex justify-between font-semibold text-base">
							<span>Total</span>
							<span>{formatPrice(availableSubtotal)}</span>
						</div>
					</div>

					<Button
						type="submit"
						size="xl"
						className="w-full"
						disabled={
							(!isLoggedIn && !customerName.trim()) ||
							hasUnavailableItems ||
							availableItems.length === 0 ||
							createOrder.isPending
						}
					>
						{createOrder.isPending ? "Creando pedido..." : "Crear pedido"}
					</Button>

					{!isLoggedIn && (
						<p className="text-center text-xs text-muted-foreground">
							<Link
								to="/iniciar-sesion"
								className="hover:text-foreground underline transition-colors"
							>
								Inicia sesión
							</Link>{" "}
							para guardar tus datos y hacer seguimiento a tus pedidos.
						</p>
					)}
				</form>
			</div>
		</div>
	);
}
