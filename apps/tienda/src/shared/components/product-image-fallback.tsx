import { cn } from "@renovabit/ui/lib/utils";

/**
 * Placeholders estáticos del storefront. Viven en `public/images/products/`
 * y se generan a partir de `apps/tienda/.raw/gen-image/` con `sharp`.
 */
const PLACEHOLDER_LIGHT = "/images/products/placeholder-light.webp";
const PLACEHOLDER_DARK = "/images/products/placeholder-dark.webp";

interface ProductImageFallbackProps {
	/** Texto alternativo de la variante visible (la oculta queda fuera del árbol a11y). */
	alt: string;
	/**
	 * Clases de layout de la imagen real (object-fit, padding, hover). Se aplican
	 * a ambas variantes para que el hueco mida exactamente lo mismo.
	 */
	className?: string;
	loading?: "lazy" | "eager";
}

/**
 * Fallback temático para productos sin imagen.
 *
 * Las dos variantes se renderizan y el tema decide cuál se ve (`display:none`
 * en la otra), así el swap no depende de JavaScript y no hay layout shift.
 */
export function ProductImageFallback({
	alt,
	className,
	loading = "lazy",
}: ProductImageFallbackProps) {
	return (
		<>
			<img
				src={PLACEHOLDER_LIGHT}
				alt={alt}
				draggable={false}
				loading={loading}
				decoding="async"
				className={cn("select-none dark:hidden", className)}
			/>
			<img
				src={PLACEHOLDER_DARK}
				alt={alt}
				draggable={false}
				loading={loading}
				decoding="async"
				className={cn("select-none hidden dark:block", className)}
			/>
		</>
	);
}
