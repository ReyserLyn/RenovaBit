import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@renovabit/ui/components/ui/carousel";
import { cn } from "@renovabit/ui/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { categoryQueries, type FeaturedCategory } from "@/features/categories/hooks/queries";

const VIEW_ALL_LABEL = "Ver todas las categorías";
const NAV_THRESHOLD = 5;

/** Carrusel de categorías destacadas en la home. */
export function CategorySection() {
	const { data: categories } = useSuspenseQuery(categoryQueries.featured());

	if (categories.length === 0) return null;

	const hasNavigation = categories.length > NAV_THRESHOLD;

	return (
		<section className="container mx-auto max-w-7xl space-y-4 px-4 py-16 md:py-20">
			<div className="flex items-center justify-between gap-4">
				<h2 className="text-lg font-semibold tracking-tight">Lo más buscado</h2>
				<ViewAllLink className="hidden sm:inline-flex" />
			</div>

			<div className="px-11">
				<Carousel
					opts={{
						align: "start",
						slidesToScroll: 1,
						loop: true,
					}}
					className="w-full"
				>
					<CarouselContent>
						{categories.map((cat) => (
							<CarouselItem
								key={cat.id}
								className="basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5"
							>
								<CategoryLink category={cat} />
							</CarouselItem>
						))}
					</CarouselContent>

					{hasNavigation && <CarouselPrevious className="-left-6" />}
					{hasNavigation && <CarouselNext className="-right-6" />}
				</Carousel>
			</div>

			<div className="sm:hidden">
				<ViewAllLink />
			</div>
		</section>
	);
}

function ViewAllLink({ className }: { className?: string }) {
	return (
		<a
			href="/productos"
			className={cn(
				"text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm font-medium transition-colors",
				className,
			)}
		>
			{VIEW_ALL_LABEL}
			<HugeiconsIcon icon={ArrowRight01Icon} size={14} />
		</a>
	);
}

function CategoryLink({ category }: { category: FeaturedCategory }) {
	const { slug, name, imageUrl } = category;

	return (
		<a
			href={`/categoria/${slug}`}
			className="group block rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
		>
			<div className="bg-muted/30 rounded-full relative aspect-square w-full overflow-hidden">
				{imageUrl ? (
					<img
						src={imageUrl}
						alt={name}
						loading="lazy"
						decoding="async"
						className="absolute inset-0 h-full w-full object-contain p-6 transition-transform duration-300 group-hover:scale-105"
					/>
				) : (
					<div className="absolute inset-0 flex items-center justify-center">
						<span className="text-muted-foreground text-3xl font-bold">
							{name.charAt(0).toUpperCase()}
						</span>
					</div>
				)}
			</div>
			<p className="mt-3 text-center font-semibold text-lg transition-colors group-hover:text-primary">
				{name}
			</p>
		</a>
	);
}
