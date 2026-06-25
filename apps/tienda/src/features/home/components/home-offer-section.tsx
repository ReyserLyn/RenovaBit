import { ArrowRight01Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Button } from "@renovabit/ui/components/ui/button";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@renovabit/ui/components/ui/carousel";
import { useSuspenseQuery } from "@tanstack/react-query";
import Autoplay from "embla-carousel-autoplay";
import { useFavoriteStatusMap } from "@/features/favorites/hooks/queries";
import { OfferCountdown } from "@/features/offers/components/offer-countdown";
import { offerQueries } from "@/features/offers/hooks/queries";
import { useOfferCountdown } from "@/features/offers/hooks/use-offer-countdown";
import type { OfferWithProducts } from "@/features/offers/types";
import { mapOfferProductForCard } from "@/features/offers/utils";
import { ProductCard } from "@/features/products/components/product-card";

const NAV_THRESHOLD = 5;
const OUTER_CAROUSEL_DELAY = 6000;
const INNER_CAROUSEL_DELAY = 5000;

/** Sección home: ofertas activas destacadas. Layout adaptativo por #offers y #productos. */
export function HomeOfferSection() {
	const { data } = useSuspenseQuery(offerQueries.featured());

	// Filtrar offers vacías para no mostrar cards muertas
	const offers = data.offers.filter((o) => o.products.items.length > 0);
	const favoriteStatuses = useFavoriteStatusMap(
		offers.flatMap((o) => o.products.items.map((p) => p.id)),
	);

	if (offers.length === 0) return null;

	const useOuterCarousel = offers.length > NAV_THRESHOLD;

	return (
		<section className="container mx-auto max-w-7xl space-y-8 px-4 py-16 md:py-20">
			<header className="space-y-2">
				<h2 className="text-2xl font-bold tracking-tight">Ofertas activas</h2>
				<p className="text-muted-foreground text-sm">Descuentos por tiempo limitado.</p>
			</header>

			{useOuterCarousel ? (
				<Carousel
					opts={{ align: "start", slidesToScroll: 1, loop: true }}
					plugins={[Autoplay({ delay: OUTER_CAROUSEL_DELAY, stopOnInteraction: false })]}
					className="w-full"
				>
					<CarouselContent>
						{offers.map((offer) => (
							<CarouselItem key={offer.id} className="basis-full">
								<OfferBlock offer={offer} favoriteStatuses={favoriteStatuses} />
							</CarouselItem>
						))}
					</CarouselContent>
					{/* Mobile: botones abajo para no robar ancho a las cards */}
					<div className="mt-4 flex items-center justify-center gap-3 sm:hidden">
						<CarouselPrevious className="static translate-x-0 translate-y-0" />
						<CarouselNext className="static translate-x-0 translate-y-0" />
					</div>
					{/* Desktop: botones a los lados */}
					<CarouselPrevious className="hidden -left-6 sm:flex" />
					<CarouselNext className="hidden -right-6 sm:flex" />
				</Carousel>
			) : (
				<div className="space-y-10">
					{offers.map((offer) => (
						<OfferBlock key={offer.id} offer={offer} favoriteStatuses={favoriteStatuses} />
					))}
				</div>
			)}

			<div className="flex justify-center pt-2">
				<Button variant="outline" size="lg" nativeButton={false} render={<a href="/ofertas" />}>
					Ver todas las ofertas
					<HugeiconsIcon icon={ArrowRight01Icon} size={16} />
				</Button>
			</div>
		</section>
	);
}

// ── Per-offer block ────────────────────────────────

function OfferBlock({
	offer,
	favoriteStatuses,
}: {
	offer: OfferWithProducts;
	favoriteStatuses: Readonly<Record<string, boolean>>;
}) {
	const { label, status } = useOfferCountdown(offer.startsAt, offer.endsAt);
	const isEnded = status === "ended";
	const products = offer.products.items;
	const useInnerCarousel = products.length >= NAV_THRESHOLD;
	const discountPercent = Math.round(Number.parseFloat(offer.discountValue) || 0);

	return (
		<article className="space-y-5">
			{/* Header: name (left) + discount badge (right) */}
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
				<h3 className="text-lg font-semibold tracking-tight">{offer.name}</h3>
				<Badge className="bg-destructive text-destructive-foreground px-2.5 py-0.5 text-sm font-bold tracking-wide">
					-{discountPercent}% OFF
				</Badge>
			</div>

			{/* Sub-header: countdown + description */}
			<div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
				<span className="inline-flex items-center gap-1.5">
					<HugeiconsIcon icon={Clock01Icon} size={14} />
					<OfferCountdown label={label} status={status} endsAt={offer.endsAt} />
				</span>
				{offer.description && (
					<>
						<span aria-hidden="true" className="text-muted-foreground/40">
							·
						</span>
						<span className="line-clamp-1 min-w-0">{offer.description}</span>
					</>
				)}
			</div>

			{/* Products */}
			{useInnerCarousel ? (
				<div className="sm:px-11">
					<Carousel
						opts={{ align: "start", slidesToScroll: 1, loop: true }}
						plugins={[Autoplay({ delay: INNER_CAROUSEL_DELAY, stopOnInteraction: false })]}
						className="w-full"
					>
						<CarouselContent>
							{products.map((product) => (
								<CarouselItem
									key={product.id}
									className="basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/4"
								>
									<ProductCard
										product={mapOfferProductForCard(product, isEnded)}
										isFavorite={favoriteStatuses[product.id] ?? false}
									/>
								</CarouselItem>
							))}
						</CarouselContent>
						{/* Mobile: botones abajo para no robar ancho a las cards */}
						<div className="mt-4 flex items-center justify-center gap-3 sm:hidden">
							<CarouselPrevious className="static translate-x-0 translate-y-0" />
							<CarouselNext className="static translate-x-0 translate-y-0" />
						</div>
						{/* Desktop: botones a los lados */}
						<CarouselPrevious className="hidden -left-6 sm:flex" />
						<CarouselNext className="hidden -right-6 sm:flex" />
					</Carousel>
				</div>
			) : (
				<div className="flex flex-wrap justify-center gap-4">
					{products.map((product) => (
						<div key={product.id} className="w-full sm:w-72">
							<ProductCard
								product={mapOfferProductForCard(product, isEnded)}
								isFavorite={favoriteStatuses[product.id] ?? false}
							/>
						</div>
					))}
				</div>
			)}
		</article>
	);
}
