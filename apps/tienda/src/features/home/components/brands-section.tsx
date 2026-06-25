import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@renovabit/ui/components/ui/carousel";
import { useSuspenseQuery } from "@tanstack/react-query";
import Autoplay from "embla-carousel-autoplay";
import { brandQueries, type FeaturedBrand } from "@/features/brands/hooks/queries";

const NAV_THRESHOLD = 5; // mismo umbral que CategorySection
const AUTOPLAY_DELAY = 5000; // entre offers (6000) y related (4000)

export function BrandsSection() {
	const { data: brands } = useSuspenseQuery(brandQueries.featured());

	if (brands.length === 0) return null;

	const hasNavigation = brands.length > NAV_THRESHOLD;

	return (
		<section className="container mx-auto max-w-7xl space-y-8 px-4 py-16 md:py-20">
			<header className="space-y-2">
				<h2 className="text-2xl font-bold tracking-tight">Trabajamos con las mejores marcas</h2>
				<p className="text-muted-foreground text-sm">Calidad y respaldo en cada producto.</p>
			</header>

			<div>
				{hasNavigation ? (
					<div className="px-11">
						<Carousel
							opts={{ align: "start", slidesToScroll: 1, loop: true }}
							plugins={[
								Autoplay({
									delay: AUTOPLAY_DELAY,
									stopOnInteraction: true,
									stopOnMouseEnter: true,
								}),
							]}
							className="w-full"
						>
							<CarouselContent>
								{brands.map((brand) => (
									<CarouselItem
										key={brand.id}
										className="basis-1/3 sm:basis-1/4 md:basis-1/5 lg:basis-1/6"
									>
										<BrandLink brand={brand} />
									</CarouselItem>
								))}
							</CarouselContent>
							{/* Mobile: botones abajo para no robar ancho a los tiles */}
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
						{brands.map((brand) => (
							<div key={brand.id} className="w-full sm:w-40">
								<BrandLink brand={brand} />
							</div>
						))}
					</div>
				)}
			</div>
		</section>
	);
}

function BrandLink({ brand }: { brand: FeaturedBrand }) {
	return (
		<a
			href={`/marca/${brand.slug}`}
			className="group block rounded-lg focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
		>
			<div className="bg-card border-border hover:border-primary/50 flex h-20 w-full items-center justify-center rounded-lg border p-4 transition-all hover:shadow-md">
				{brand.imageUrl ? (
					<img
						src={brand.imageUrl}
						alt={brand.name}
						loading="lazy"
						decoding="async"
						className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
					/>
				) : (
					<span className="text-muted-foreground text-center text-sm font-semibold">
						{brand.name}
					</span>
				)}
			</div>
		</a>
	);
}
