import { ImageNotFound01Icon, ShoppingCartIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import { cn } from "@renovabit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { FavoriteButton } from "@/shared/components/favorites/favorite-button";
import { formatPrice } from "@/shared/lib/format";
import type { ProductListItem } from "../types";

interface ProductCardProps {
	product: ProductListItem;
}

export function ProductCard({ product }: ProductCardProps) {
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

				{/* Badge oferta */}
				{product.isFeatured && (
					<Badge variant="warning" size="sm" radius="full" className="absolute left-2 top-2">
						Oferta
					</Badge>
				)}
			</Link>

			{/* ── Botón favorito ─────────────────── */}
			<FavoriteButton slug={product.slug} className="absolute right-2 top-2 z-10 size-8" />

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

					<Button variant="outline" size="xl" disabled>
						<HugeiconsIcon icon={ShoppingCartIcon} size={16} />
						Añadir
					</Button>
				</div>
			</div>
		</div>
	);
}
