import { Clock01Icon, Location01Icon, Mail01Icon, TelephoneIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { LogoHorizontal } from "@renovabit/ui/components/branding";
import { Separator } from "@renovabit/ui/components/ui/separator";
import { Link } from "@tanstack/react-router";
import {
	FacebookIcon,
	GitHubIcon,
	InstagramIcon,
	TikTokIcon,
	WhatsAppIcon,
} from "@/shared/components/icons";

// ── Config ──────────────────────────────────────────────

const contactItems = [
	{
		icon: Mail01Icon,
		label: "Email",
		values: [
			{ value: "info@renovabit.com", href: "mailto:info@renovabit.com" },
			{
				value: "contacto@renovabit.com",
				href: "mailto:contacto@renovabit.com",
			},
			{ value: "soporte@renovabit.com", href: "mailto:soporte@renovabit.com" },
		],
	},
	{
		icon: TelephoneIcon,
		label: "Teléfono",
		values: [{ value: "987 471 074", href: "tel:987471074" }],
	},
	{
		icon: Location01Icon,
		label: "Dirección",
		values: [{ value: "Av. Goyeneche 1602, Miraflores, Arequipa - 04004", href: null }],
	},
	{
		icon: Clock01Icon,
		label: "Horario",
		values: [{ value: "Lunes a Viernes, 8:00 AM - 8:00 PM", href: null }],
	},
] as const;

const storeLinks = [
	{ name: "Inicio", to: "/" },
	{ name: "Ofertas", to: "/ofertas" },
	{ name: "Arma tu PC", to: "/arma-tu-pc" },
	{ name: "Carrito", to: "/carrito" },
] as const;

const categoryLinks = [
	{ name: "Procesadores", to: "/categoria/procesadores" },
	{ name: "Tarjetas gráficas", to: "/categoria/tarjetas-graficas" },
	{ name: "Placas madre", to: "/categoria/placas-madre" },
	{ name: "Memorias RAM", to: "/categoria/memorias-ram" },
	{ name: "Almacenamiento", to: "/categoria/almacenamiento" },
	{ name: "Fuentes de poder", to: "/categoria/fuentes-de-poder" },
] as const;

const infoLinks = [
	{ name: "Sobre nosotros", to: "/sobre-nosotros" },
	{ name: "Contacto", to: "/contacto" },
	{ name: "Términos y condiciones", to: "/terminos-condiciones" },
	{ name: "Política de privacidad", to: "/politica-privacidad" },
	{ name: "Política de envíos", to: "/politica-envios" },
	{ name: "Devoluciones y garantía", to: "/politica-devoluciones" },
] as const;

const socialLinks = [
	{
		icon: FacebookIcon,
		name: "Facebook",
		href: "https://www.facebook.com/RenovaBitPE",
	},
	{
		icon: InstagramIcon,
		name: "Instagram",
		href: "https://www.instagram.com/renovabit",
	},
	{
		icon: TikTokIcon,
		name: "TikTok",
		href: "https://www.tiktok.com/@renovabit",
	},
	{ icon: WhatsAppIcon, name: "WhatsApp", href: "https://wa.me/51987471074" },
	{
		icon: GitHubIcon,
		name: "GitHub",
		href: "https://github.com/ReyserLyn/renovabit",
	},
] as const;

// ── Sub-components ──────────────────────────────────────

function SocialLinks() {
	return (
		<div className="flex items-center gap-3">
			{socialLinks.map((social) => (
				<a
					key={social.name}
					href={social.href}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={social.name}
					className="bg-accent/60 hover:bg-accent/80 text-foreground inline-flex size-9 items-center justify-center rounded-full transition-colors duration-200 hover:scale-110 active:scale-95"
				>
					<social.icon className="size-5" />
				</a>
			))}
		</div>
	);
}

function LinkColumn({
	title,
	links,
}: {
	title: string;
	links: ReadonlyArray<{ name: string; to: string }>;
}) {
	return (
		<div>
			<h4 className="mb-3 text-sm font-semibold tracking-tight text-foreground">{title}</h4>
			<ul className="space-y-2">
				{links.map((link) => (
					<li key={link.to}>
						<Link
							to={link.to}
							className="text-muted-foreground hover:text-primary inline-block text-sm transition-colors duration-200"
						>
							{link.name}
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}

// ── Footer ──────────────────────────────────────────────

export default function Footer() {
	return (
		<footer className="border-t border-border bg-linear-to-br from-muted/30 to-muted/10">
			<div className="container mx-auto px-4 py-12">
				{/* ── Fila superior: Logo + Social ── */}
				<div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
					<Link to="/" className="shrink-0">
						<LogoHorizontal className="w-[170px] md:w-[200px]" />
					</Link>

					<div className="flex flex-col items-start gap-4 md:items-end">
						<p className="text-muted-foreground text-sm">Síguenos en redes sociales</p>
						<SocialLinks />
					</div>
				</div>

				{/* ── Columnas de contenido ── */}
				<div className="flex flex-col lg:gap-20 xl:gap-30 md:flex-row md:items-start mb-6 gap-6">
					{/* Contacto  */}
					<div className="md:w-[340px] md:shrink-0">
						<h4 className="mb-4 text-sm font-semibold tracking-tight text-foreground">Contacto</h4>
						<ul className="space-y-4">
							{contactItems.map((item) => (
								<li key={item.label} className="flex items-start gap-3">
									<div className="flex w-20 shrink-0 items-center gap-2">
										<div className="text-primary shrink-0">
											<HugeiconsIcon icon={item.icon} size={16} />
										</div>
										<span className="text-muted-foreground text-sm font-medium">{item.label}</span>
									</div>
									<div className="flex flex-1 flex-col gap-1">
										{item.values.map((v) =>
											v.href ? (
												<a
													key={v.value}
													href={v.href}
													className="text-foreground hover:text-primary block text-sm transition-colors duration-200"
												>
													{v.value}
												</a>
											) : (
												<p key={v.value} className="text-foreground text-sm whitespace-pre-line">
													{v.value}
												</p>
											),
										)}
									</div>
								</li>
							))}
						</ul>
					</div>

					<Separator orientation="vertical" className="hidden md:block" />

					{/* Links: 3 columnas con gap reducido */}
					<div className="grid grid-cols-1 gap-6 md:flex-1 md:grid-cols-3">
						<div>
							<LinkColumn title="Tienda" links={storeLinks} />
						</div>

						<div>
							<LinkColumn title="Categorías" links={categoryLinks} />
						</div>

						<div>
							<LinkColumn title="Información" links={infoLinks} />
						</div>
					</div>
				</div>

				{/* ── Copyright ── */}
				<div className="mt-12 border-t border-border pt-8 text-center">
					<p className="text-muted-foreground text-xs">
						&copy; {new Date().getFullYear()} RenovaBit &mdash; Todos los derechos reservados.
					</p>
				</div>
			</div>
		</footer>
	);
}
