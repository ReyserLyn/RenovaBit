import { HugeiconsIcon } from "@hugeicons/react";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@renovabit/ui/components/ui/sidebar";
import { Link, useRouterState } from "@tanstack/react-router";
import { memo } from "react";
import type { SidebarMainItem } from "@/shared/config/sidebar-nav";

type NavMainProps = {
	items: readonly SidebarMainItem[];
};

function NavMainComponent({ items }: NavMainProps) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Accesos rápidos</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => (
					<SidebarMenuItem key={item.url}>
						<SidebarMenuButton
							isActive={pathname === item.url}
							tooltip={item.name}
							render={(props) => (
								<Link {...props} preload="intent" to={item.url}>
									<HugeiconsIcon icon={item.icon} color="currentColor" />
									<span>{item.name}</span>
								</Link>
							)}
						/>
					</SidebarMenuItem>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}

export const NavMain = memo(NavMainComponent);
