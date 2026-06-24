import { ArrowRightIcon, Tag01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { WhatsAppIcon } from "@/shared/components/icons/whatsapp-icon";
import { buildWhatsAppUrl } from "@/shared/lib/contact";

const WHATSAPP_URL = buildWhatsAppUrl({
	message: "Hola, vengo del sitio web y quiero más información sobre sus productos.",
});

export function HeroSection() {
	return (
		<section aria-label="Hero principal" className="px-4 py-4 md:px-6 md:py-6">
			<div className="relative mx-auto h-[70vh] min-h-[500px] max-h-[800px] w-full max-w-7xl overflow-hidden rounded-2xl md:rounded-3xl">
				{/* Background image — preloaded in the route's head for fast LCP */}
				<picture>
					<source srcSet="/images/hero/hero-laptop-components.avif" type="image/avif" />
					<source srcSet="/images/hero/hero-laptop-components.webp" type="image/webp" />
					<img
						src="/images/hero/hero-laptop-components.jpg"
						alt="Laptop y componentes de tecnología en Arequipa"
						className="absolute inset-0 h-full w-full object-cover"
						loading="eager"
						decoding="async"
						fetchPriority="high"
					/>
				</picture>

				{/* Gradient overlay for text readability */}
				<div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/40 to-black/20 md:bg-linear-to-r md:from-black/75 md:via-black/40 md:to-transparent" />

				{/* Text overlay */}
				<div className="container relative z-10 mx-auto flex h-full max-w-7xl items-center px-6 md:px-12">
					<div className="max-w-2xl space-y-6 text-white">
						<h1 className="text-4xl font-bold tracking-tight drop-shadow-lg md:text-5xl lg:text-6xl">
							Componentes, laptops y soporte técnico en Arequipa
						</h1>
						<p className="text-lg drop-shadow-md md:text-xl">
							Equipos, refacciones y servicio técnico con garantía real. Envíos a todo Perú.
						</p>
						<div className="flex flex-col gap-3 pt-2 sm:flex-row">
							<Button
								nativeButton={false}
								render={<a href="/ofertas" />}
								size="xl"
								className="shadow-lg"
							>
								<HugeiconsIcon icon={Tag01Icon} size={16} />
								Ver ofertas
								<HugeiconsIcon icon={ArrowRightIcon} size={16} />
							</Button>
							<Button
								nativeButton={false}
								variant="whatsapp"
								size="xl"
								render={<a href={WHATSAPP_URL} target="_blank" rel="noreferrer" />}
							>
								<WhatsAppIcon style={{ width: 18, height: 18 }} />
								Chatear por WhatsApp
							</Button>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
