import {
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuTrigger,
} from "@renovabit/ui/components/ui/navigation-menu";
import { useSuspenseQuery } from "@tanstack/react-query";
import { categoryQueries } from "@/features/categories/hooks/queries";
import { normalizeCategoryTree } from "@/features/categories/tree";
import { ItemList } from "./item-list";

interface NavGroup {
	name: string;
	children: Array<{ slug: string; name: string }>;
}

export function MenuCategory() {
	const { data: tree } = useSuspenseQuery(categoryQueries.tree());

	const navigationData: NavGroup[] = normalizeCategoryTree(tree).map(toNavGroup);

	return (
		<NavigationMenuItem>
			<NavigationMenuTrigger>Productos</NavigationMenuTrigger>

			<NavigationMenuContent className="p-4">
				<div className="grid grid-cols-1 gap-3 p-4 md:w-[600px] md:grid-cols-3 lg:w-[800px] lg:grid-cols-4">
					{navigationData.length === 0 ? (
						<EmptyProducts />
					) : (
						navigationData.map((group) => (
							<div className="px-2" key={group.name}>
								<h6 className="font-semibold text-muted-foreground text-sm uppercase">
									{group.name}
								</h6>
								<ul className="mt-2.5 grid gap-3">
									{(group.children ?? []).map((category) => (
										<ItemList
											href={`/categoria/${category.slug}`}
											key={category.slug}
											title={category.name}
										/>
									))}
								</ul>
							</div>
						))
					)}
				</div>
			</NavigationMenuContent>
		</NavigationMenuItem>
	);
}

function EmptyProducts() {
	return <p className="text-muted-foreground text-sm">No hay productos disponibles</p>;
}

// ── Helpers ────────────────────────────────────────────────────

function toNavGroup(node: {
	name: string;
	children: Array<{ slug: string; name: string }>;
}): NavGroup {
	return {
		name: node.name,
		children: node.children.map((child) => ({ slug: child.slug, name: child.name })),
	};
}
