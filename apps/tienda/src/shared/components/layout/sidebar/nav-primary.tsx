import {
	ComputerIcon,
	Home01Icon,
	PercentSquareIcon,
	ShoppingCart01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@renovabit/ui/components/ui/sidebar";
import { Link, useRouterState } from "@tanstack/react-router";
import { memo } from "react";

const PRIMARY_LINKS = [
	{ label: "Inicio", to: "/", icon: Home01Icon },
	{ label: "Ofertas", to: "/ofertas", icon: PercentSquareIcon },
	{ label: "Arma tu PC", to: "/arma-tu-pc", icon: ComputerIcon },
	{ label: "Carrito", to: "/carrito", icon: ShoppingCart01Icon },
] as const;

function NavPrimaryComponent() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const { setOpenMobile } = useSidebar();

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Acciones Rápidas</SidebarGroupLabel>
			<SidebarMenu>
				{PRIMARY_LINKS.map((link) => (
					<SidebarMenuItem key={link.to}>
						<SidebarMenuButton
							isActive={pathname === link.to}
							tooltip={link.label}
							render={(props) => (
								<Link {...props} preload="intent" to={link.to} onClick={() => setOpenMobile(false)}>
									<HugeiconsIcon icon={link.icon} color="currentColor" />
									<span>{link.label}</span>
								</Link>
							)}
						/>
					</SidebarMenuItem>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}

export const NavPrimary = memo(NavPrimaryComponent);
