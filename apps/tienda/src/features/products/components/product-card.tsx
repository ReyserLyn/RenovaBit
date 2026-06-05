import { ImageNotFound01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { formatPrice } from "@/shared/lib/format";
import type { ProductListItem } from "../types";

interface ProductCardProps {
	product: ProductListItem;
}

export function ProductCard({ product }: ProductCardProps) {
	const hasImage = product.primaryImage?.url;

	return (
		<a
			href={`/producto/${product.slug}`}
			className="group block overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
		>
			{/* Imagen */}
			<div className="relative aspect-square overflow-hidden bg-muted">
				{hasImage ? (
					<img
						src={product.primaryImage!.url}
						alt={product.primaryImage!.alt ?? product.name}
						loading="lazy"
						className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
					/>
				) : (
					<div className="flex h-full w-full items-center justify-center text-muted-foreground">
						<HugeiconsIcon icon={ImageNotFound01Icon} size={48} strokeWidth={1} />
					</div>
				)}
			</div>

			{/* Info */}
			<div className="space-y-1.5 p-3">
				{/* Marca */}
				{product.brand && (
					<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
						{product.brand.name}
					</p>
				)}

				{/* Nombre */}
				<h3 className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary transition-colors">
					{product.name}
				</h3>

				{/* Precio */}
				<p className="text-base font-bold text-foreground">{formatPrice(product.price)}</p>
			</div>
		</a>
	);
}
