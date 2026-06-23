import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@renovabit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useAddFavorite, useRemoveFavorite } from "@/features/favorites/hooks/mutations";
import { type FavoriteSnapshot } from "@/features/favorites/hooks/queries";
import { authSessionQueryOptions } from "@/shared/lib/auth/auth-session";

interface FavoriteButtonProps {
	productId: string;
	/** Pre-resolved favorite status from the parent's batched query. */
	isFavorite: boolean;
	snapshot: FavoriteSnapshot;
	className?: string;
	size?: number;
}

export function FavoriteButton({
	productId,
	isFavorite,
	snapshot,
	className,
	size = 18,
}: FavoriteButtonProps) {
	const { data: session } = useQuery(authSessionQueryOptions());
	const isAuthenticated = !!session?.user;

	const addFavorite = useAddFavorite();
	const removeFavorite = useRemoveFavorite();
	const isPending = addFavorite.isPending || removeFavorite.isPending;

	// Hide for unauthenticated users
	if (!isAuthenticated) return null;

	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		if (isFavorite) {
			removeFavorite.mutate(productId);
		} else {
			addFavorite.mutate({ productId, snapshot });
		}
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={isPending}
			aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
			aria-pressed={isFavorite}
			className={cn(
				"flex cursor-pointer items-center justify-center rounded-full backdrop-blur-xs transition-all duration-200",
				"hover:scale-110 active:scale-90",
				"disabled:cursor-not-allowed disabled:opacity-50",
				isFavorite
					? "bg-destructive/15 text-destructive hover:bg-destructive/25"
					: "bg-background/70 text-muted-foreground hover:bg-background/90 hover:text-foreground",
				className,
			)}
		>
			<HugeiconsIcon
				icon={FavouriteIcon}
				size={size}
				className={cn("transition-all duration-200", isFavorite && "fill-destructive")}
			/>
		</button>
	);
}
