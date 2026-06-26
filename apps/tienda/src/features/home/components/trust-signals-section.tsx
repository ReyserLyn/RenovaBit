import { Shield01Icon, ToolsIcon, TruckDeliveryIcon, UndoIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const SIGNALS = [
	{
		icon: Shield01Icon,
		title: "Garantía 30-90 días",
		description: "Cobertura formal en todos los servicios técnicos.",
	},
	{
		icon: TruckDeliveryIcon,
		title: "Envío a todo Perú",
		description: "Despachamos a Lima, provincias y zonas alejadas.",
	},
	{
		icon: ToolsIcon,
		title: "Soporte técnico incluido",
		description: "Asesoría antes y después de tu compra.",
	},
	{
		icon: UndoIcon,
		title: "Devolución 30 días",
		description: "Si no te convence, cambiamos o devolvemos.",
	},
] as const;

export function TrustSignalsSection() {
	return (
		<section className="border-y border-border/60 bg-muted/20">
			<div className="container mx-auto max-w-7xl px-4 py-16 md:py-20">
				<h2 className="mb-10 text-center text-2xl font-bold tracking-tight">
					¿Por qué elegir RenovaBit?
				</h2>
				<div className="grid grid-cols-1 divide-y divide-border/60 sm:grid-cols-2 sm:divide-y-0 sm:divide-x md:grid-cols-4">
					{SIGNALS.map((signal) => (
						<div
							key={signal.title}
							className="group flex flex-col items-center justify-center gap-3 px-6 py-8 text-center"
						>
							<HugeiconsIcon
								icon={signal.icon}
								size={20}
								strokeWidth={1.25}
								className="text-foreground/70 transition-colors group-hover:text-foreground"
							/>
							<h3 className="text-sm font-medium tracking-wide">{signal.title}</h3>
							<p className="text-muted-foreground max-w-[28ch] text-xs leading-relaxed">
								{signal.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
