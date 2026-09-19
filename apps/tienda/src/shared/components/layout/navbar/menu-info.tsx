import {
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuTrigger,
} from "@renovabit/ui/components/ui/navigation-menu";
import { buildWhatsAppUrl } from "@/shared/lib/contact";
import { ItemList } from "./item-list";

const CONTACT_URL = buildWhatsAppUrl({
	message: "Hola, quiero hacer una consulta sobre sus productos.",
});

const COMPANY_LINKS = [
	{
		href: CONTACT_URL,
		title: "Contacto",
	},
] as const;

const POLICY_LINKS = [
	{
		href: "/terminos-y-condiciones",
		title: "Términos y Condiciones",
	},
	{
		href: "/politica-de-privacidad",
		title: "Política de Privacidad",
	},
	{
		href: "/politicas-de-envio-y-devolucion",
		title: "Políticas de Envío y Devolución",
	},
	{
		href: "/libro-de-reclamaciones",
		title: "Libro de Reclamaciones",
	},
] as const;

export function MenuInfo() {
	return (
		<NavigationMenuItem>
			<NavigationMenuTrigger>Información</NavigationMenuTrigger>

			<NavigationMenuContent className="p-4">
				<div className="grid grid-cols-1 gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
					<div className="px-2">
						<h6 className="mb-2.5 font-semibold text-muted-foreground text-sm uppercase">
							Empresa
						</h6>
						<ul className="grid gap-3">
							{COMPANY_LINKS.map((link) => (
								<ItemList href={link.href} key={link.href} title={link.title} />
							))}
						</ul>
					</div>

					<div className="px-2">
						<h6 className="mb-2.5 font-semibold text-muted-foreground text-sm uppercase">
							Políticas
						</h6>
						<ul className="grid gap-3">
							{POLICY_LINKS.map((link) => (
								<ItemList href={link.href} key={link.href} title={link.title} />
							))}
						</ul>
					</div>
				</div>
			</NavigationMenuContent>
		</NavigationMenuItem>
	);
}
