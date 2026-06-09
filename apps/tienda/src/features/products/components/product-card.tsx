import {
	FavouriteIcon,
	ImageNotFound01Icon,
	ShoppingCartIcon,
	ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import { cn } from "@renovabit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { formatPrice } from "@/shared/lib/format";
import { useFavoritesStore } from "@/shared/lib/stores/favorites";
import type { ProductListItem } from "../types";

interface ProductCardProps {
	product: ProductListItem;
}

export function ProductCard({ product }: ProductCardProps) {
	const favorites = useFavoritesStore((s) => s.favorites);
	const toggle = useFavoritesStore((s) => s.toggle);
	const liked = favorites.includes(product.slug);

	const handleFavoriteClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		toggle(product.slug);
	};

	return (
		<div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-all duration-200 hover:shadow-md">
			{/* ── Imagen ─────────────────────────── */}
			<Link
				to="/producto/$slug"
				params={{ slug: product.slug }}
				className="relative block aspect-square overflow-hidden bg-[#f1f1f7] p-3"
			>
				{product.primaryImage?.url ? (
					<img
						src={product.primaryImage.url}
						alt={product.primaryImage.alt ?? product.name}
						loading="lazy"
						decoding="async"
						className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
						<HugeiconsIcon icon={ImageNotFound01Icon} size={48} strokeWidth={1} />
					</div>
				)}

				{/* Badge oferta */}
				{product.isFeatured && (
					<Badge variant="warning" size="sm" radius="full" className="absolute left-2 top-2">
						Oferta
					</Badge>
				)}
			</Link>

			{/* ── Botón favorito ─────────────────── */}
			<button
				type="button"
				onClick={handleFavoriteClick}
				aria-label={liked ? "Quitar de favoritos" : "Agregar a favoritos"}
				className={cn(
					"absolute right-2 top-2 z-10 flex size-8 cursor-pointer items-center justify-center rounded-full backdrop-blur-xs transition-all duration-200",
					"hover:scale-110 active:scale-90",
					liked
						? "bg-destructive/15 text-destructive hover:bg-destructive/25"
						: "bg-background/70 text-muted-foreground hover:bg-background/90 hover:text-foreground",
				)}
			>
				<HugeiconsIcon
					icon={FavouriteIcon}
					size={18}
					className={cn("transition-all duration-200", liked && "fill-destructive")}
				/>
			</button>

			{/* ── Info ───────────────────────────── */}
			<div className="flex flex-1 flex-col gap-1.5 p-4">
				{/* Marca + Stock */}
				<div className="flex items-center justify-between gap-2">
					{product.brand && (
						<p className="text-muted-foreground truncate text-[0.7rem] font-semibold uppercase tracking-widest">
							{product.brand.name}
						</p>
					)}
					<p
						className={cn(
							"shrink-0 text-[0.7rem]",
							product.stock > 0 ? "text-muted-foreground" : "text-destructive font-medium",
						)}
					>
						{product.stock > 0 ? `Stock: ${product.stock}` : "Agotado"}
					</p>
				</div>

				{/* Nombre — altura fija 2 líneas */}
				<h3 className="line-clamp-2 min-h-[2.5em] text-base font-medium leading-snug">
					<Link
						to="/producto/$slug"
						params={{ slug: product.slug }}
						className="hover:text-primary transition-colors"
					>
						{product.name}
					</Link>
				</h3>

				{/* Precio */}
				<p className="mt-auto pt-1 text-xl font-bold tracking-tight">
					{formatPrice(product.price)}
				</p>

				{/* ── Botones ──────────────────────── */}
				<div className="mt-2 flex flex-col gap-1.5 sm:flex-row">
					<Button
						nativeButton={false}
						className="flex-1"
						render={
							<Link to="/producto/$slug" params={{ slug: product.slug }}>
								<HugeiconsIcon icon={ViewIcon} size={16} />
								Ver producto
							</Link>
						}
					/>

					<Button variant="outline" className="flex-1" disabled>
						<HugeiconsIcon icon={ShoppingCartIcon} size={16} />
						Añadir
					</Button>
				</div>
			</div>
		</div>
	);
}
