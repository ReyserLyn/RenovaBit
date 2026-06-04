import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "@renovabit/ui/components/ui/sidebar";
import type { ComponentProps } from "react";
import { NavCatalog } from "./nav-catalog";
import { NavLogo } from "./nav-logo";
import { NavPrimary } from "./nav-primary";
import { NavUser } from "./nav-user";

type AppSidebarProps = ComponentProps<typeof Sidebar>;

export function AppSidebar(props: AppSidebarProps) {
	return (
		<Sidebar collapsible="offcanvas" className="md:hidden" {...props}>
			<SidebarHeader>
				<NavLogo />
			</SidebarHeader>

			<SidebarContent>
				<NavPrimary />
				<NavCatalog />
			</SidebarContent>

			<SidebarFooter>
				<NavUser />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
