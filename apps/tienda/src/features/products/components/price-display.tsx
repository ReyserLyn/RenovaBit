import { Badge } from "@renovabit/ui/components/ui/badge";
import { cn } from "@renovabit/ui/lib/utils";
import { formatPrice } from "@/shared/lib/format";

interface PriceDisplayProps {
	basePrice: string;
	/** Offer price (with role-aware discount applied). When set, shows dual-price + badge. */
	offerPrice?: string | null;
	/** Discount percent (0–100). When >0 and offerPrice differs, shows discount badge. */
	discountPercent?: number | null;
	className?: string;
	size?: "sm" | "md" | "lg" | "xl";
}

export function PriceDisplay({
	basePrice,
	offerPrice,
	discountPercent,
	className,
	size = "xl",
}: PriceDisplayProps) {
	const priceSize = {
		sm: "text-base",
		md: "text-xl",
		lg: "text-2xl",
		xl: "text-4xl",
	}[size];

	const hasOffer = offerPrice !== undefined && offerPrice !== null && offerPrice !== basePrice;

	if (!hasOffer) {
		return (
			<div className={cn("flex items-baseline gap-3", className)}>
				<p className={cn("font-bold tracking-tight", priceSize)}>{formatPrice(basePrice)}</p>
			</div>
		);
	}

	return (
		<div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
			{/* Screen-reader summary describing the price relationship. */}
			<span className="sr-only">
				{`Precio en oferta: ${formatPrice(offerPrice)}, antes ${formatPrice(basePrice)}${
					discountPercent && discountPercent > 0 ? `, ahorro ${discountPercent}%` : ""
				}`}
			</span>
			<div className="flex items-baseline gap-2" aria-hidden="true">
				<del className="text-muted-foreground text-sm">{formatPrice(basePrice)}</del>
				<span className={cn("font-bold tracking-tight text-primary", priceSize)}>
					{formatPrice(offerPrice)}
				</span>
			</div>
			{discountPercent !== undefined && discountPercent !== null && discountPercent > 0 && (
				<Badge
					variant="destructive"
					size="sm"
					radius="full"
					className="shrink-0"
					aria-label={`Descuento ${discountPercent} por ciento`}
				>
					-{discountPercent}%
				</Badge>
			)}
		</div>
	);
}
