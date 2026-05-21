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
} from "@renovabit/ui/components/ui/sidebar";
import { Link, useRouterState } from "@tanstack/react-router";
import { memo, useEffect, useState } from "react";
import type { SidebarSection } from "@/shared/config/sidebar-nav";

type NavSecondaryProps = {
	items: readonly SidebarSection[];
};

function subItemKey(link: { title: string; url: string }): string {
	return `${link.url}:${link.title}`;
}

function NavSecondarySection({ section, pathname }: { section: SidebarSection; pathname: string }) {
	return (
		<SidebarMenuItem>
			<Collapsible className="group/collapsible w-full">
				<CollapsibleTrigger
					render={
						<SidebarMenuButton tooltip={section.title}>
							<HugeiconsIcon icon={section.icon} color="currentColor" />
							<span>{section.title}</span>
							<HugeiconsIcon
								icon={ArrowRight01Icon}
								className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90"
							/>
						</SidebarMenuButton>
					}
				/>
				<CollapsibleContent>
					<SidebarMenuSub>
						{section.items.map((sub) => (
							<SidebarMenuSubItem key={subItemKey(sub)}>
								<SidebarMenuSubButton
									isActive={pathname === sub.url}
									render={(props) => (
										<Link {...props} preload="intent" to={sub.url}>
											<span>{sub.title}</span>
										</Link>
									)}
								/>
							</SidebarMenuSubItem>
						))}
					</SidebarMenuSub>
				</CollapsibleContent>
			</Collapsible>
		</SidebarMenuItem>
	);
}

function NavSecondaryComponent({ items }: NavSecondaryProps) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Catálogo y operaciones</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((section) => (
					<NavSecondarySection key={section.title} pathname={pathname} section={section} />
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}

export const NavSecondary = memo(NavSecondaryComponent);
