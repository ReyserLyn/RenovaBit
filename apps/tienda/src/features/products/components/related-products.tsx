import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@renovabit/ui/components/ui/carousel";
import { useSuspenseQuery } from "@tanstack/react-query";
import Autoplay from "embla-carousel-autoplay";
import { ProductCard } from "@/features/products/components/product-card";
import { productQueries } from "@/features/products/hooks/queries";

interface RelatedProductsProps {
	currentSlug: string;
	categorySlug: string;
}

/** Carrusel de productos de la misma categoría, excluyendo el producto actual. */
export function RelatedProducts({ currentSlug, categorySlug }: RelatedProductsProps) {
	const { data: products } = useSuspenseQuery(
		productQueries.list({ categorySlug, excludeSlug: currentSlug }, 8),
	);

	if (products.length === 0) return null;

	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-semibold tracking-tight">Productos relacionados</h2>
			</div>

			<div className="px-11">
				<Carousel
					opts={{
						align: "start",
						slidesToScroll: 1,
						loop: true,
					}}
					plugins={[Autoplay({ delay: 4000, stopOnInteraction: false })]}
					className="w-full"
				>
					<CarouselContent>
						{products.map((product) => (
							<CarouselItem
								key={product.id}
								className="basis-1/1 sm:basis-1/3 lg:basis-1/4 xl:basis-1/5"
							>
								<ProductCard product={product} />
							</CarouselItem>
						))}
					</CarouselContent>

					{products.length > 5 && <CarouselPrevious className="-left-6" />}
					{products.length > 5 && <CarouselNext className="-right-6" />}
				</Carousel>
			</div>
		</section>
	);
}
