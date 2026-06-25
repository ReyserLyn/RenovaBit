import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@renovabit/ui/components/ui/carousel";
import { useSuspenseQuery } from "@tanstack/react-query";
import Autoplay from "embla-carousel-autoplay";
import { memo, useMemo } from "react";
import { useFavoriteStatusMap } from "@/features/favorites/hooks/queries";
import { ProductCard } from "@/features/products/components/product-card";
import { productQueries } from "@/features/products/hooks/queries";
import type { ProductListItem } from "@/features/products/types";

// 4 cols desktop × 2 rows = 8 productos por slide (3 cols en md, 2 en sm, 1 en móvil)
const CHUNK_SIZE = 8;
const FEATURED_LIMIT = 24; // 3 slides para mantener la home ligera
const AUTOPLAY_DELAY = 7000; // más lento que las offers (5000/6000ms)
const CAROUSEL_THRESHOLD = 8; // con 8 o menos, grid plano (no hay con qué paginar)

/** Sección home: productos destacados. Carousel 4×2 con autoplay lento. */
export function FeaturedProductsSection() {
	const { data: products } = useSuspenseQuery(
		productQueries.list({ isFeatured: true, sortBy: "newest" }, FEATURED_LIMIT),
	);
	// Estabilizar productIds para que useFavoriteStatusMap no recalcule en cada render.
	const productIds = useMemo(() => products.map((p) => p.id), [products]);
	const favoriteStatuses = useFavoriteStatusMap(productIds);

	if (products.length === 0) return null;

	const showCarousel = products.length > CAROUSEL_THRESHOLD;
	const chunks = chunk(products, CHUNK_SIZE);

	return (
		<section className="container mx-auto max-w-7xl space-y-8 px-4 py-16 md:py-20">
			<header className="space-y-2">
				<h2 className="text-2xl font-bold tracking-tight">Productos destacados</h2>
				<p className="text-muted-foreground text-sm">Lo más pedido por nuestros clientes.</p>
			</header>

			{showCarousel ? (
				<Carousel
					opts={{ align: "start", slidesToScroll: 1, loop: true }}
					plugins={[Autoplay({ delay: AUTOPLAY_DELAY, stopOnInteraction: true })]}
					className="w-full"
				>
					<CarouselContent>
						{chunks.map((chunkProducts) => (
							<CarouselItem key={chunkProducts[0]?.id ?? "empty"} className="basis-full">
								<ProductGrid products={chunkProducts} favoriteStatuses={favoriteStatuses} />
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
				<ProductGrid products={products} favoriteStatuses={favoriteStatuses} />
			)}
		</section>
	);
}

/**
 * Grid centrado de ProductCards. Mismo patrón que el `OfferBlock` de la home:
 * flex-wrap con `justify-center` para que las cards se centren cuando no
 * llenan una fila completa (ej. 6 productos en un row de 4).
 *
 * Memoizado: si `products` y `favoriteStatuses` no cambian por referencia,
 * no re-renderiza los ProductCard internos. Es seguro con `useSuspenseQuery`
 * (misma ref mientras el queryKey no cambie) y con `useFavoriteStatusMap`
 * cuando recibe `productIds` memoizado.
 */
const ProductGrid = memo(function ProductGrid({
	products,
	favoriteStatuses,
}: {
	products: ProductListItem[];
	favoriteStatuses: Readonly<Record<string, boolean>>;
}) {
	return (
		<div className="flex flex-wrap justify-center gap-4">
			{products.map((product) => (
				<div key={product.id} className="w-full sm:w-72">
					<ProductCard product={product} isFavorite={favoriteStatuses[product.id] ?? false} />
				</div>
			))}
		</div>
	);
});

function chunk<T>(arr: readonly T[], size: number): T[][] {
	const result: T[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		result.push(arr.slice(i, i + size));
	}
	return result;
}
