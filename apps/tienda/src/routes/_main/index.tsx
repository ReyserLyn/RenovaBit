import { createFileRoute } from "@tanstack/react-router";
import { HeroSection } from "@/features/home/components/hero-section";
import { seo } from "@/shared/lib/seo";

export const Route = createFileRoute("/_main/")({
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

export function HomePage() {
	return (
		<div className="flex flex-1 flex-col">
			<HeroSection />
		</div>
	);
}
