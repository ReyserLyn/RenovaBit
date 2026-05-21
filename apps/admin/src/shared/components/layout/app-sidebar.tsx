import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "@renovabit/ui/components/ui/sidebar";
import type { ComponentProps } from "react";
import { NavLogo } from "@/shared/components/sidebar/nav-logo";
import { NavMain } from "@/shared/components/sidebar/nav-main";
import { NavSecondary } from "@/shared/components/sidebar/nav-secondary";
import { NavUser } from "@/shared/components/sidebar/nav-user";
import { sidebarNavigation } from "@/shared/config/sidebar-nav";
import { User } from "@/shared/lib/auth/auth-client";

type AppSidebarProps = ComponentProps<typeof Sidebar> & {
	user: User;
};

export function AppSidebar({ user, ...props }: AppSidebarProps) {
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<NavLogo />
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={sidebarNavigation.main} />
				<NavSecondary items={sidebarNavigation.sections} />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
