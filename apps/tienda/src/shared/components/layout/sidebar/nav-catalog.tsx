import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@renovabit/ui/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from "@renovabit/ui/components/ui/sidebar";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { memo } from "react";
import { brandQueries } from "@/features/brands/hooks/queries";
import { categoryQueries } from "@/features/categories/hooks/queries";
import { normalizeCategoryTree } from "@/features/categories/tree";

function NavCatalogComponent() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const { data: tree } = useSuspenseQuery(categoryQueries.tree());
	const { data: brands = [] } = useSuspenseQuery(brandQueries.list());
	const { setOpenMobile } = useSidebar();

	const rootCategories = normalizeCategoryTree(tree).filter((node) => node.children.length > 0);

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Catálogo</SidebarGroupLabel>
			<SidebarMenu>
				{rootCategories.map((cat) => (
					<SidebarMenuItem key={cat.slug}>
						<Collapsible className="group/collapsible w-full">
							<CollapsibleTrigger
								render={
									<SidebarMenuButton tooltip={cat.name}>
										<span>{cat.name}</span>
										<HugeiconsIcon
											icon={ArrowRight01Icon}
											className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90"
										/>
									</SidebarMenuButton>
								}
							/>
							<CollapsibleContent>
								<SidebarMenuSub>
									{cat.children.map((child) => (
										<SidebarMenuSubItem key={child.slug}>
											<SidebarMenuSubButton
												isActive={pathname.startsWith(`/categoria/${child.slug}`)}
												render={(props) => (
													<Link
														{...props}
														preload="intent"
														to="/categoria/$slug"
														params={{ slug: child.slug }}
														search={{}}
														onClick={() => setOpenMobile(false)}
													>
														<span>{child.name}</span>
													</Link>
												)}
											/>
										</SidebarMenuSubItem>
									))}
								</SidebarMenuSub>
							</CollapsibleContent>
						</Collapsible>
					</SidebarMenuItem>
				))}

				<SidebarMenuItem>
					<Collapsible className="group/collapsible w-full">
						<CollapsibleTrigger
							render={
								<SidebarMenuButton tooltip="Marcas">
									<span>Marcas</span>
									<HugeiconsIcon
										icon={ArrowRight01Icon}
										className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90"
									/>
								</SidebarMenuButton>
							}
						/>
						<CollapsibleContent>
							<SidebarMenuSub>
								{brands.map((brand) => (
									<SidebarMenuSubItem key={brand.id}>
										<SidebarMenuSubButton
											isActive={pathname === `/marca/${brand.slug}`}
											render={(props) => (
												<Link
													{...props}
													preload="intent"
													to="/marca/$slug"
													params={{ slug: brand.slug }}
													search={{}}
													onClick={() => setOpenMobile(false)}
												>
													<span>{brand.name}</span>
												</Link>
											)}
										/>
									</SidebarMenuSubItem>
								))}
							</SidebarMenuSub>
						</CollapsibleContent>
					</Collapsible>
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarGroup>
	);
}

export const NavCatalog = memo(NavCatalogComponent);
