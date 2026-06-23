import { ImageNotFound01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@renovabit/ui/components/ui/empty";
import { ProductCard } from "@/features/products/components/product-card";
import { useOfferCountdown } from "../hooks/use-offer-countdown";
import type { OfferProductPage, OfferWithProducts } from "../types";
import { OfferCountdown } from "./offer-countdown";

interface OfferSectionProps {
	offer: OfferWithProducts;
	filteredProducts: OfferProductPage;
	isLoadingMore: boolean;
	onLoadMore: () => void;
}

export function OfferSection({
	offer,
	filteredProducts,
	isLoadingMore,
	onLoadMore,
}: OfferSectionProps) {
	const { label, status } = useOfferCountdown(offer.startsAt, offer.endsAt);
	const isEnded = status === "ended";

	const hasMore =
		filteredProducts.nextOffset !== null &&
		filteredProducts.items.length > 0 &&
		filteredProducts.items.length < filteredProducts.total;

	return (
		<section id={`offer-${offer.slug}`} className="space-y-4 scroll-mt-24">
			{/* Section heading with countdown */}
			<div className="flex items-center justify-between gap-3">
				<h2 className="text-2xl font-bold tracking-tight">{offer.name}</h2>
				<OfferCountdown label={label} status={status} endsAt={offer.endsAt} />
			</div>

			{offer.description && <p className="text-muted-foreground text-sm">{offer.description}</p>}

			{/* Product grid */}
			{filteredProducts.items.length > 0 ? (
				<>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
						{filteredProducts.items.map((product) => (
							<ProductCard
								key={product.id}
								product={{
									id: product.id,
									name: product.name,
									slug: product.slug,
									price: product.basePrice ?? "0",
									// When the offer has ended (tab left open), drop the offer
									// price so cards reflect the current non-discounted price.
									offerPrice: isEnded ? null : product.offerPrice,
									discountPercent: isEnded ? 0 : product.discountPercent,
									stock: product.stock,
									sku: product.sku,
									isFeatured: false,
									primaryImage: product.primaryImage
										? { url: product.primaryImage, alt: null }
										: null,
									brand: product.brand ?? null,
									category: null,
									offers: [],
								}}
							/>
						))}
					</div>

					{/* Load more button */}
					{hasMore && (
						<div className="flex justify-center pt-2">
							<Button variant="outline" size="lg" disabled={isLoadingMore} onClick={onLoadMore}>
								{isLoadingMore ? "Cargando..." : `Cargar 20 más`}
							</Button>
						</div>
					)}
				</>
			) : (
				<Empty>
					<EmptyMedia>
						<HugeiconsIcon icon={ImageNotFound01Icon} size={24} strokeWidth={1} />
					</EmptyMedia>
					<EmptyHeader>
						<EmptyTitle>Sin productos</EmptyTitle>
					</EmptyHeader>
					<EmptyContent>
						<EmptyDescription>
							No hay productos en esta oferta que coincidan con los filtros.
						</EmptyDescription>
					</EmptyContent>
				</Empty>
			)}
		</section>
	);
}
