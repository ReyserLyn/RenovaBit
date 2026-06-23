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

	return (
		<div className={cn("flex items-baseline gap-3", className)}>
			{hasOffer ? (
				<>
					<div className="flex items-baseline gap-2">
						<span className="text-muted-foreground line-through text-sm">
							{formatPrice(basePrice)}
						</span>
						<span className={cn("font-bold tracking-tight text-primary", priceSize)}>
							{formatPrice(offerPrice)}
						</span>
					</div>
					{discountPercent !== undefined && discountPercent !== null && discountPercent > 0 && (
						<Badge variant="destructive" size="sm" radius="full">
							–{discountPercent}%
						</Badge>
					)}
				</>
			) : (
				<p className={cn("font-bold tracking-tight", priceSize)}>{formatPrice(basePrice)}</p>
			)}
		</div>
	);
}
