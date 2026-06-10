import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { cn } from "@renovabit/ui/lib/utils";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { createContext, forwardRef, useCallback, useContext, useEffect, useState } from "react";

// ── Types ───────────────────────────────────────────

type CarouselApi = UseEmblaCarouselType[1];
type CarouselOptions = NonNullable<Parameters<typeof useEmblaCarousel>[0]>;
type CarouselPlugin = NonNullable<Parameters<typeof useEmblaCarousel>[1]>;

interface CarouselProps {
	opts?: CarouselOptions;
	plugins?: CarouselPlugin;
	orientation?: "horizontal" | "vertical";
	setApi?: (api: CarouselApi) => void;
	className?: string;
	children: React.ReactNode;
}

interface CarouselContextValue {
	carouselRef: ReturnType<typeof useEmblaCarousel>[0];
	api: CarouselApi;
	scrollPrev: () => void;
	scrollNext: () => void;
	canScrollPrev: boolean;
	canScrollNext: boolean;
	orientation: "horizontal" | "vertical";
}

// ── Context ─────────────────────────────────────────

const CarouselContext = createContext<CarouselContextValue | null>(null);

function useCarousel() {
	const ctx = useContext(CarouselContext);
	if (!ctx) {
		throw new Error("useCarousel must be used within a <Carousel />");
	}
	return ctx;
}

// ── Root ────────────────────────────────────────────

const Carousel = forwardRef<HTMLDivElement, CarouselProps>(
	({ opts, plugins, orientation = "horizontal", setApi, className, children, ...props }, ref) => {
		const [carouselRef, api] = useEmblaCarousel(
			{
				...opts,
				axis: orientation === "horizontal" ? "x" : "y",
			},
			plugins,
		);
		const [canScrollPrev, setCanScrollPrev] = useState(false);
		const [canScrollNext, setCanScrollNext] = useState(false);

		const onSelect = useCallback((emblaApi: CarouselApi) => {
			if (!emblaApi) return;
			setCanScrollPrev(emblaApi.canScrollPrev());
			setCanScrollNext(emblaApi.canScrollNext());
		}, []);

		const scrollPrev = useCallback(() => api?.scrollPrev(), [api]);
		const scrollNext = useCallback(() => api?.scrollNext(), [api]);

		useEffect(() => {
			if (!api || !setApi) return;
			setApi(api);
		}, [api, setApi]);

		useEffect(() => {
			if (!api) return;
			onSelect(api);
			api.on("reInit", onSelect);
			api.on("select", onSelect);
			return () => {
				api.off("reInit", onSelect);
				api.off("select", onSelect);
			};
		}, [api, onSelect]);

		return (
			<CarouselContext.Provider
				value={{
					carouselRef,
					api,
					scrollPrev,
					scrollNext,
					canScrollPrev,
					canScrollNext,
					orientation,
				}}
			>
				<div
					ref={ref}
					className={cn("relative", className)}
					role="region"
					aria-roledescription="carousel"
					{...props}
				>
					{children}
				</div>
			</CarouselContext.Provider>
		);
	},
);
Carousel.displayName = "Carousel";

// ── Content ─────────────────────────────────────────

const CarouselContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => {
		const { carouselRef, orientation } = useCarousel();

		return (
			<div ref={carouselRef} className="overflow-hidden">
				<div
					ref={ref}
					className={cn(
						"flex",
						orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
						className,
					)}
					{...props}
				/>
			</div>
		);
	},
);
CarouselContent.displayName = "CarouselContent";

// ── Item ────────────────────────────────────────────

const CarouselItem = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => {
		const { orientation } = useCarousel();

		return (
			<div
				ref={ref}
				role="group"
				aria-roledescription="slide"
				className={cn(
					"min-w-0 shrink-0 grow-0",
					orientation === "horizontal" ? "pl-4" : "pt-4",
					className,
				)}
				{...props}
			/>
		);
	},
);
CarouselItem.displayName = "CarouselItem";

// ── Previous ────────────────────────────────────────

const CarouselPrevious = forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
	({ className, variant = "ghost", size = "icon", ...props }, ref) => {
		const { scrollPrev, canScrollPrev, orientation } = useCarousel();

		return (
			<Button
				ref={ref}
				variant={variant}
				size={size}
				className={cn(
					"absolute z-10 size-9 rounded-full border border-border bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-0",
					orientation === "horizontal"
						? "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2"
						: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rotate-90",
					className,
				)}
				disabled={!canScrollPrev}
				onClick={scrollPrev}
				{...props}
			>
				<HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
				<span className="sr-only">Anterior</span>
			</Button>
		);
	},
);
CarouselPrevious.displayName = "CarouselPrevious";

// ── Next ────────────────────────────────────────────

const CarouselNext = forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
	({ className, variant = "ghost", size = "icon", ...props }, ref) => {
		const { scrollNext, canScrollNext, orientation } = useCarousel();

		return (
			<Button
				ref={ref}
				variant={variant}
				size={size}
				className={cn(
					"absolute z-10 size-9 rounded-full border border-border bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-0",
					orientation === "horizontal"
						? "right-0 top-1/2 translate-x-1/2 -translate-y-1/2"
						: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-90",
					className,
				)}
				disabled={!canScrollNext}
				onClick={scrollNext}
				{...props}
			>
				<HugeiconsIcon icon={ArrowRight01Icon} size={16} />
				<span className="sr-only">Siguiente</span>
			</Button>
		);
	},
);
CarouselNext.displayName = "CarouselNext";

// ── Exports ─────────────────────────────────────────

export {
	Carousel,
	type CarouselApi,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
};
