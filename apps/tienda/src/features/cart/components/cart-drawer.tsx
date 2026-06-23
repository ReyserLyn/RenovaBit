import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { Separator } from "@renovabit/ui/components/ui/separator";
import { useNavigate } from "@tanstack/react-router";
import type { CartResponse } from "@/features/cart/hooks/queries";
import { getEffectiveLinePrice } from "@/features/cart/lib/pricing";
import { summarizeAvailableCartItems } from "@/features/cart/lib/summary";
import { formatPrice } from "@/shared/lib/format";
import { CartItem } from "./cart-item";

type NonNullCart = NonNullable<CartResponse>;

interface CartDrawerContentProps {
	cart: NonNullCart;
	isLoading: boolean;
	onNavigate?: () => void;
}

export function CartDrawerContent({ cart, isLoading, onNavigate }: CartDrawerContentProps) {
	const navigate = useNavigate();
	const { availableItems, availableItemsCount, totalSaved } = summarizeAvailableCartItems(
		cart.items,
	);

	const hasPriceChange = availableItems.some((item) => item.priceChanged);
	const availableSubtotal = availableItems
		.reduce((sum, item) => sum + getEffectiveLinePrice(item).unitPrice * item.quantity, 0)
		.toFixed(2);

	const handleNavigateCart = () => {
		onNavigate?.();
		navigate({ to: "/carrito" });
	};

	return (
		<div className="flex flex-1 flex-col min-h-0">
			<div className="flex-1 overflow-y-auto px-4 min-h-0">
				{isLoading ? (
					<div className="space-y-3 py-2">
						{[1, 2, 3].map((i) => (
							<div key={i} className="flex gap-3">
								<div className="size-16 animate-pulse rounded-lg bg-muted" />
								<div className="flex-1 space-y-2">
									<div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
									<div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
								</div>
							</div>
						))}
					</div>
				) : cart.items.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<p className="text-muted-foreground text-sm">Tu carrito está vacío</p>
						<Button variant="link" className="mt-1" onClick={() => navigate({ to: "/" })}>
							Ver productos
						</Button>
					</div>
				) : (
					<div className="space-y-3 py-2">
						{cart.items.map((item) => (
							<CartItem key={item.id} item={item} />
						))}
					</div>
				)}
			</div>

			{cart.items.length > 0 && (
				<div className="px-4 pb-4">
					<Separator className="mb-4" />

					{/* Price changed banner (T4) */}
					{hasPriceChange && (
						<div className="mb-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-2 text-xs text-warning-foreground">
							<HugeiconsIcon icon={AlertCircleIcon} size={14} className="mt-0.5 shrink-0" />
							<span>Algunos precios cambiaron. Revisá antes de pagar.</span>
						</div>
					)}

					<div className="space-y-3">
						{/* Total saved (T4) */}
						{totalSaved && (
							<div className="flex items-center justify-between text-xs text-success">
								<span>Total ahorrado</span>
								<span className="font-semibold">{formatPrice(totalSaved)}</span>
							</div>
						)}

						{/* Separator between savings and subtotal (T4) */}
						{totalSaved && <Separator />}

						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">
								Subtotal ({availableItemsCount}{" "}
								{availableItemsCount === 1 ? "producto" : "productos"})
							</span>
							<span className="font-semibold">{formatPrice(availableSubtotal)}</span>
						</div>

						{availableItems.length < cart.items.length && (
							<p className="text-xs text-warning">
								Algunos productos no están disponibles. Revisa tu carrito.
							</p>
						)}

						<Button
							size="xl"
							className="w-full"
							disabled={availableItems.length === 0}
							onClick={handleNavigateCart}
						>
							Ir al carrito
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
