import { ImageNotFound01Icon, ShoppingCartIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import { cn } from "@renovabit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useAddToCart } from "@/features/cart/hooks/mutations";
import { PriceDisplay } from "@/features/products/components/price-display";
import { HighlightedText } from "@/features/search/components/highlighted-text";
import { FavoriteButton } from "@/shared/components/favorites/favorite-button";
import type { ProductListItem } from "../types";

interface ProductCardProps {
	product: ProductListItem;
	isFavorite: boolean;
}

export function ProductCard({ product, isFavorite }: ProductCardProps) {
	const addToCart = useAddToCart();
	// isInStock from search results overrides stock-based calculation
	const isAvailable = product.isInStock !== undefined ? product.isInStock : product.stock > 0;

	return (
		<div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-all duration-200 hover:shadow-md">
			{/* ── Imagen ─────────────────────────── */}
			<Link
				to="/producto/$slug"
				params={{ slug: product.slug }}
				onDragStart={(e) => e.preventDefault()}
				className="relative block aspect-square overflow-hidden bg-[#f1f1f7] p-3"
			>
				{product.primaryImage?.url ? (
					<img
						src={product.primaryImage.url}
						alt={product.primaryImage.alt ?? product.name}
						draggable={false}
						loading="lazy"
						decoding="async"
						className="select-none h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
						<HugeiconsIcon icon={ImageNotFound01Icon} size={48} strokeWidth={1} />
					</div>
				)}

				{/* Badge agotado */}
				{(product.isInStock === false ||
					(product.isInStock === undefined && product.stock <= 0)) && (
					<Badge variant="destructive" size="sm" radius="full" className="absolute left-2 top-2">
						Agotado
					</Badge>
				)}
			</Link>

			{/* ── Botón favorito ─────────────────── */}
			<FavoriteButton
				productId={product.id}
				isFavorite={isFavorite}
				snapshot={{
					productId: product.id,
					productName: product.name,
					productSlug: product.slug,
					productSku: product.sku,
					price: product.price,
					stock: product.stock,
					isInStock: product.isInStock ?? product.stock > 0,
					primaryImage: product.primaryImage,
					brand: product.brand,
					category: product.category ?? null,
				}}
				className="absolute right-2 top-2 z-10 size-8"
			/>

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
							isAvailable ? "text-muted-foreground" : "text-destructive font-medium",
						)}
					>
						{isAvailable ? `Stock: ${product.stock}` : "Agotado"}
					</p>
				</div>

				{/* Nombre — altura fija 2 líneas */}
				<h3 className="line-clamp-2 min-h-[2.5em] text-base font-medium leading-snug">
					<Link
						to="/producto/$slug"
						params={{ slug: product.slug }}
						className="hover:text-primary transition-colors"
					>
						{product.headline ? <HighlightedText text={product.headline} /> : product.name}
					</Link>
				</h3>

				{/* Precio */}
				<PriceDisplay
					basePrice={product.price}
					offerPrice={product.offerPrice}
					discountPercent={product.discountPercent}
					size="md"
					className="mt-auto pt-1"
				/>

				{/* ── Botones ──────────────────────── */}
				<div className="mt-2 flex flex-col gap-1.5">
					<Button
						nativeButton={false}
						size="xl"
						render={
							<Link to="/producto/$slug" params={{ slug: product.slug }}>
								<HugeiconsIcon icon={ViewIcon} size={16} />
								Ver producto
							</Link>
						}
					/>

					<Button
						variant="outline"
						size="xl"
						disabled={addToCart.isPending || !isAvailable}
						onClick={() => addToCart.mutate({ productId: product.id })}
					>
						<HugeiconsIcon icon={ShoppingCartIcon} size={16} />
						{addToCart.isPending ? "..." : "Añadir"}
					</Button>
				</div>
			</div>
		</div>
	);
}
