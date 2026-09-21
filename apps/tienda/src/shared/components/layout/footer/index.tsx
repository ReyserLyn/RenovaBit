import { Clock01Icon, Location01Icon, Mail01Icon, TelephoneIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { LogoHorizontal } from "@renovabit/ui/components/branding";
import { Separator } from "@renovabit/ui/components/ui/separator";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { categoryQueries } from "@/features/categories/hooks/queries";
import { getLeafCategories } from "@/features/categories/leaves";
import {
	FacebookIcon,
	GitHubIcon,
	InstagramIcon,
	TikTokIcon,
	WhatsAppIcon,
} from "@/shared/components/icons";
import { BUSINESS } from "@/shared/lib/business";

// ── Config ──────────────────────────────────────────────

const FOOTER_CATEGORY_LIMIT = 6;

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
		values: [{ value: BUSINESS.phoneDisplay, href: BUSINESS.phoneHref }],
	},
	{
		icon: Location01Icon,
		label: "Dirección",
		values: [{ value: BUSINESS.address, href: null }],
	},
	{
		icon: Clock01Icon,
		label: "Horario",
		values: [{ value: BUSINESS.schedule, href: null }],
	},
] as const;

const storeLinks = [
	{ name: "Inicio", to: "/" },
	{ name: "Ofertas", to: "/ofertas" },
	{ name: "Carrito", to: "/carrito" },
] as const;

// Exact route paths under `_main` — must stay in sync with `menu-info.tsx`.
const infoLinks = [
	{ name: "Términos y condiciones", to: "/terminos-y-condiciones" },
	{ name: "Política de privacidad", to: "/politica-de-privacidad" },
	{ name: "Envíos y devoluciones", to: "/politicas-de-envio-y-devolucion" },
	{ name: "Libro de Reclamaciones", to: "/libro-de-reclamaciones" },
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
	{ icon: WhatsAppIcon, name: "WhatsApp", href: "https://wa.me/51955315646" },
	{
		icon: GitHubIcon,
		name: "GitHub",
		href: "https://github.com/ReyserLyn/renovabit",
	},
] as const;

/** Landing de servicio técnico: enlace de vuelta con UTM para atribución. */
const SERVICE_URL =
	"https://renovabit.com/servicios/servicio-tecnico/?utm_source=tienda&utm_medium=footer&utm_campaign=servicio-tecnico";

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

/**
 * Categories come from the same tree cached by the `_main` layout loader
 * (single source of truth), so a footer link can never point to a slug that
 * does not exist. Top leaves by product count keep the column useful.
 */
function CategoryColumn() {
	const { data: tree } = useSuspenseQuery(categoryQueries.tree());
	const links = useMemo(
		() =>
			getLeafCategories(tree)
				.sort((a, b) => b.productCount - a.productCount)
				.slice(0, FOOTER_CATEGORY_LIMIT),
		[tree],
	);

	return (
		<div>
			<h4 className="mb-3 text-sm font-semibold tracking-tight text-foreground">Categorías</h4>
			<ul className="space-y-2">
				{links.map((link) => (
					<li key={link.slug}>
						<Link
							to="/categoria/$slug"
							params={{ slug: link.slug }}
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

						<CategoryColumn />

						<div>
							<LinkColumn title="Información" links={infoLinks} />
							<a
								href={SERVICE_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="text-muted-foreground hover:text-primary mt-2 inline-block text-sm transition-colors duration-200"
							>
								Servicio técnico
							</a>
						</div>
					</div>
				</div>

				{/* ── Copyright ── */}
				<div className="mt-12 border-t border-border pt-8 text-center">
					<p className="text-muted-foreground text-xs">
						&copy; {new Date().getFullYear()} RenovaBit &mdash; Todos los derechos reservados.
					</p>
					<p className="text-muted-foreground mt-2 text-xs">
						<Link
							to="/libro-de-reclamaciones"
							className="hover:text-primary underline underline-offset-2 transition-colors duration-200"
						>
							Libro de Reclamaciones
						</Link>{" "}
						a disposición de los consumidores.
					</p>
					<p className="text-muted-foreground mt-2 text-xs">
						{BUSINESS.tradeName} &middot; {BUSINESS.legalName} &middot; RUC {BUSINESS.ruc}
					</p>
				</div>
			</div>
		</footer>
	);
}
