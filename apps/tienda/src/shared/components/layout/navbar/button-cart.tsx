import { ShoppingCartIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";

type CartButtonProps = {
	itemCount?: number;
	totalPrice?: number;
	onCartClick?: () => void;
};

export default function ButtonCart({
	itemCount = 0,
	totalPrice = 0,
	onCartClick,
}: CartButtonProps) {
	const displayCount = itemCount > 99 ? "99+" : itemCount.toString();
	const hasItems = itemCount > 0;
	const displayText = hasItems ? `S/ ${totalPrice.toFixed(2)}` : "Carrito";

	return (
		<>
			{/* Mobile */}
			<Button
				aria-label={`Carrito con ${itemCount} productos`}
				className="relative md:hidden"
				onClick={onCartClick}
				variant="outline"
			>
				<HugeiconsIcon icon={ShoppingCartIcon} size={16} />
				{hasItems && (
					<Badge
						className="-translate-y-1/2 -translate-x-1/2 absolute start-full top-0 rtl:translate-x-1/2"
						radius="full"
						size="sm"
					>
						{displayCount}
					</Badge>
				)}
			</Button>

			{/* Desktop */}
			<Button
				aria-label={`Carrito con ${itemCount} productos`}
				className="hidden md:flex"
				onClick={onCartClick}
				variant="outline"
			>
				<HugeiconsIcon icon={ShoppingCartIcon} size={16} />
				{displayText}
				{hasItems && (
					<Badge radius="full" size="sm">
						{displayCount}
					</Badge>
				)}
			</Button>
		</>
	);
}
