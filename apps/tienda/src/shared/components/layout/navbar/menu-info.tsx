import {
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuTrigger,
} from "@renovabit/ui/components/ui/navigation-menu";
import { ItemList } from "./item-list";

const COMPANY_LINKS = [
	{
		href: "/sobre-nosotros",
		title: "Sobre Nosotros",
	},
	{
		href: "/contacto",
		title: "Contacto",
	},
] as const;

const POLICY_LINKS = [
	{
		href: "/terminos-condiciones",
		title: "Términos y Condiciones",
	},
	{
		href: "/politica-privacidad",
		title: "Política de Privacidad",
	},
	{
		href: "/politica-envios",
		title: "Política de Envíos",
	},
	{
		href: "/politica-devoluciones",
		title: "Devoluciones y Garantía",
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
