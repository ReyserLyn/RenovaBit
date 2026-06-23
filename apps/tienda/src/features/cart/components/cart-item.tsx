import { AlertCircleIcon, Delete01Icon, ImageNotFound01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import { cn } from "@renovabit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useRemoveCartItem, useUpdateCartItem } from "@/features/cart/hooks/mutations";
import type { CartResponse } from "@/features/cart/hooks/queries";
import { formatPrice } from "@/shared/lib/format";

type CartItemData = NonNullable<CartResponse>["items"][number];

interface CartItemProps {
	item: CartItemData;
}

export function CartItem({ item }: CartItemProps) {
	const updateMutation = useUpdateCartItem();
	const removeMutation = useRemoveCartItem();

	const isUnavailable = item.status === "unavailable" || item.status === "out_of_stock";
	const statusLabel =
		item.status === "out_of_stock"
			? "Agotado"
			: item.status === "unavailable"
				? "No disponible"
				: null;

	// ── Role-aware pricing (T3) ──
	const rolePrice = Number.parseFloat(item.currentRolePrice);
	const offerPrice = Number.parseFloat(item.currentOfferPrice);
	const savedAmount = Math.max(0, rolePrice - offerPrice);
	const effectiveUnitPrice = savedAmount > 0 ? offerPrice : rolePrice;
	const lineTotal = (effectiveUnitPrice * item.quantity).toFixed(2);
	const totalSaved = savedAmount * item.quantity;

	return (
		<div className={cn("flex gap-3 border-b border-border pb-3", isUnavailable && "opacity-60")}>
			<Link
				to="/producto/$slug"
				params={{ slug: item.productSlug }}
				className="size-16 shrink-0 overflow-hidden rounded-lg bg-[#f1f1f7]"
			>
				{item.primaryImage?.url ? (
					<img
						src={item.primaryImage.url}
						alt={item.primaryImage.alt ?? item.productName}
						className="size-full object-contain p-1"
					/>
				) : (
					<div className="flex size-full items-center justify-center text-muted-foreground/40">
						<HugeiconsIcon icon={ImageNotFound01Icon} size={24} strokeWidth={1} />
					</div>
				)}
			</Link>

			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<Link
					to="/producto/$slug"
					params={{ slug: item.productSlug }}
					className="truncate text-sm font-medium hover:text-primary transition-colors"
				>
					{item.productName}
				</Link>

				{statusLabel && (
					<Badge variant="destructive" size="xs" radius="full" className="w-fit">
						{statusLabel}
					</Badge>
				)}

				{item.statusMessage && item.status !== "out_of_stock" && item.status !== "unavailable" && (
					<p className="text-[0.65rem] leading-tight text-warning">{item.statusMessage}</p>
				)}

				<div className="mt-auto flex items-center justify-between gap-2">
					{!isUnavailable ? (
						<div className="flex items-center gap-0.5">
							<Button
								size="icon-xs"
								variant="outline"
								disabled={updateMutation.isPending || item.quantity <= 1}
								onClick={() =>
									updateMutation.mutate({
										itemId: item.id,
										quantity: item.quantity - 1,
									})
								}
							>
								–
							</Button>
							<span className="flex h-6 min-w-8 items-center justify-center text-xs font-medium tabular-nums">
								{item.quantity}
							</span>
							<Button
								size="icon-xs"
								variant="outline"
								disabled={updateMutation.isPending}
								onClick={() =>
									updateMutation.mutate({
										itemId: item.id,
										quantity: item.quantity + 1,
									})
								}
							>
								+
							</Button>
						</div>
					) : (
						<span className="text-xs text-muted-foreground">{item.quantity} unidad(es)</span>
					)}

					<div className="flex items-center gap-1">
						<div className="text-right">
							<span className="text-sm font-semibold tabular-nums">{formatPrice(lineTotal)}</span>

							{/* Unit price */}
							{item.quantity > 1 && (
								<p className="text-muted-foreground text-[0.65rem] leading-tight">
									{formatPrice(effectiveUnitPrice.toFixed(2))} c/u
								</p>
							)}

							{/* Saved amount (T3: show only when > 0) */}
							{savedAmount > 0 && (
								<span
									aria-live="polite"
									className="mt-0.5 block text-[0.6rem] leading-tight text-success"
								>
									Ahorraste {formatPrice(totalSaved.toFixed(2))}
								</span>
							)}
						</div>

						{/* Price changed warning (T3) */}
						{item.priceChanged && (
							<span title="El precio cambió desde que agregaste este producto" className="shrink-0">
								<HugeiconsIcon icon={AlertCircleIcon} size={14} className="text-warning" />
							</span>
						)}

						<Button
							size="icon-xs"
							variant="ghost"
							disabled={removeMutation.isPending}
							onClick={() => removeMutation.mutate(item.id)}
						>
							<HugeiconsIcon icon={Delete01Icon} size={14} />
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
