import { createFileRoute } from "@tanstack/react-router";
import { categoryQueries } from "@/features/categories/hooks/queries";
import { BrandsSection } from "@/features/home/components/brands-section";
import { CategorySection } from "@/features/home/components/category-section";
import { FeaturedProductsSection } from "@/features/home/components/featured-products-section";
import { FinalCtaSection } from "@/features/home/components/final-cta-section";
import { HeroSection } from "@/features/home/components/hero-section";
import { HomeOfferSection } from "@/features/home/components/home-offer-section";
import { TrustSignalsSection } from "@/features/home/components/trust-signals-section";
import { offerQueries } from "@/features/offers/hooks/queries";
import { productQueries } from "@/features/products/hooks/queries";
import { isApiClientError } from "@/shared/lib/api";
import { seo } from "@/shared/lib/seo";

export const Route = createFileRoute("/_main/")({
	loader: async ({ context: { queryClient } }) => {
		try {
			await Promise.all([
				queryClient.ensureQueryData(categoryQueries.featured()),
				queryClient.ensureQueryData(offerQueries.featured()),
				queryClient.ensureQueryData(
					productQueries.list({ isFeatured: true, sortBy: "newest" }, 24),
				),
			]);
		} catch (error) {
			if (isApiClientError(error)) throw error;
		}
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			...seo({
				title: "RenovaBit · Tienda de tecnología en Arequipa",
				description:
					"Componentes, equipos y soporte técnico con garantía real. Envíos a todo Perú desde Arequipa.",
			}).meta,
		],
		links: [
			// Preload the LCP image so it starts downloading with the HTML.
			{
				rel: "preload",
				as: "image",
				href: "/images/hero/hero-laptop-components.avif",
				type: "image/avif",
			},
		],
	}),
	component: HomePage,
});

function HomePage() {
	return (
		<div className="flex flex-1 flex-col">
			<HeroSection />
			<CategorySection />
			<HomeOfferSection />
			<FeaturedProductsSection />
			<BrandsSection />
			<TrustSignalsSection />
			<FinalCtaSection />
		</div>
	);
}
