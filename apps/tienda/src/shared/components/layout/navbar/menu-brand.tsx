import {
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuTrigger,
} from "@renovabit/ui/components/ui/navigation-menu";
import { useSuspenseQuery } from "@tanstack/react-query";
import { brandQueries } from "@/features/brands/hooks/queries";
import { ItemList } from "./item-list";

export function MenuBrand() {
	const { data: brands = [] } = useSuspenseQuery(brandQueries.list());

	return (
		<NavigationMenuItem>
			<NavigationMenuTrigger>Marcas</NavigationMenuTrigger>

			<NavigationMenuContent className="p-8">
				<h6 className="px-2 font-semibold text-muted-foreground text-sm uppercase">Marcas</h6>
				<ul className="mt-2.5 grid w-[200px] gap-3 px-2 md:w-[500px] md:grid-cols-5 lg:w-[600px]">
					{brands.length > 0 ? (
						brands.map((brand) => (
							<ItemList href={`/marca/${brand.slug}`} key={brand.id} title={brand.name} />
						))
					) : (
						<EmptyBrands />
					)}
				</ul>
			</NavigationMenuContent>
		</NavigationMenuItem>
	);
}

function EmptyBrands() {
	return <li className="col-span-full text-muted-foreground text-sm">No hay marcas disponibles</li>;
}
