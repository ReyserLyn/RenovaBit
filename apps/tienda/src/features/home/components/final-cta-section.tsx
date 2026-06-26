import { ArrowRight01Icon, ShoppingBag01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { WhatsAppIcon } from "@/shared/components/icons/whatsapp-icon";
import { buildWhatsAppUrl } from "@/shared/lib/contact";

const WHATSAPP_URL = buildWhatsAppUrl({
	message: "Hola, estoy interesado en sus productos. ¿Me pueden asesorar?",
});

/** Cierre de la home con el color brand (primary). CTA principal a WhatsApp, secundario al catálogo. */
export function FinalCtaSection() {
	return (
		<section className="bg-primary text-primary-foreground">
			<div className="container mx-auto max-w-3xl px-4 py-20 text-center md:py-28">
				{/* Hairline decorativa — premium, sin alardes */}
				<div className="bg-primary-foreground/30 mx-auto mb-10 h-px w-12" />

				<h2 className="text-3xl font-semibold tracking-tight leading-[1.05] md:text-5xl">
					¿Listo para equipar tu próximo equipo?
				</h2>

				<p className="text-primary-foreground/80 mx-auto mt-6 max-w-xl text-base leading-relaxed md:text-lg">
					Conversemos por WhatsApp. Te asesoramos según tu caso — sin compromiso, con respuesta en
					minutos.
				</p>

				<div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
					<Button
						nativeButton={false}
						variant="whatsapp"
						size="lg"
						render={<a href={WHATSAPP_URL} target="_blank" rel="noreferrer" />}
					>
						<WhatsAppIcon style={{ width: 18, height: 18 }} />
						Chatear ahora
						<HugeiconsIcon icon={ArrowRight01Icon} size={16} />
					</Button>
					<Button
						nativeButton={false}
						variant="outline"
						size="lg"
						className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:border-primary-foreground/50 hover:bg-primary-foreground/20 hover:text-primary-foreground"
						render={<a href="/productos" />}
					>
						<HugeiconsIcon icon={ShoppingBag01Icon} size={16} />
						Ver el catálogo
					</Button>
				</div>
			</div>
		</section>
	);
}
