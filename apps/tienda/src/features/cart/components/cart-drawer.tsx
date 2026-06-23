import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { Separator } from "@renovabit/ui/components/ui/separator";
import { useNavigate } from "@tanstack/react-router";
import type { CartResponse } from "@/features/cart/hooks/queries";
import { summarizeAvailableCartItems } from "@/features/cart/lib/summary";
import { formatPrice } from "@/shared/lib/format";
import { CartItem } from "./cart-item";

type NonNullCart = NonNullable<CartResponse>;
type CartItem = NonNullCart["items"][number];

interface CartDrawerContentProps {
	cart: NonNullCart;
	isLoading: boolean;
	onNavigate?: () => void;
}

/** Compute effective line price from role-aware pricing fields */
function effectivePrice(item: CartItem): number {
	const rolePrice = Number.parseFloat(item.currentRolePrice);
	const offerPrice = Number.parseFloat(item.currentOfferPrice);
	const saved = Math.max(0, rolePrice - offerPrice);
	return saved > 0 ? offerPrice : rolePrice;
}

export function CartDrawerContent({ cart, isLoading, onNavigate }: CartDrawerContentProps) {
	const navigate = useNavigate();
	const { availableItems, availableItemsCount } = summarizeAvailableCartItems(cart.items);

	// Role-aware subtotal and savings for available items (T4)
	let effectiveSubtotal = 0;
	let totalSavedAmount = 0;
	let hasPriceChange = false;

	for (const item of availableItems) {
		const unitPrice = effectivePrice(item);
		effectiveSubtotal += unitPrice * item.quantity;

		const saved = Math.max(
			0,
			Number.parseFloat(item.currentRolePrice) - Number.parseFloat(item.currentOfferPrice),
		);
		totalSavedAmount += saved * item.quantity;

		if (item.priceChanged) {
			hasPriceChange = true;
		}
	}

	const availableSubtotal = effectiveSubtotal.toFixed(2);
	const totalSaved = totalSavedAmount > 0 ? totalSavedAmount.toFixed(2) : null;

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
