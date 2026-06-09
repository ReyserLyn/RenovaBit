import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@renovabit/ui/lib/utils";
import { useFavoritesStore } from "@/shared/lib/stores/favorites";

interface FavoriteButtonProps {
	slug: string;
	className?: string;
	size?: number;
}

export function FavoriteButton({ slug, className, size = 18 }: FavoriteButtonProps) {
	const favorites = useFavoritesStore((s) => s.favorites);
	const toggle = useFavoritesStore((s) => s.toggle);
	const liked = favorites.includes(slug);

	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		toggle(slug);
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			aria-label={liked ? "Quitar de favoritos" : "Agregar a favoritos"}
			className={cn(
				"flex cursor-pointer items-center justify-center rounded-full backdrop-blur-xs transition-all duration-200",
				"hover:scale-110 active:scale-90",
				liked
					? "bg-destructive/15 text-destructive hover:bg-destructive/25"
					: "bg-background/70 text-muted-foreground hover:bg-background/90 hover:text-foreground",
				className,
			)}
		>
			<HugeiconsIcon
				icon={FavouriteIcon}
				size={size}
				className={cn("transition-all duration-200", liked && "fill-destructive")}
			/>
		</button>
	);
}
