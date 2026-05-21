import { LogoMonogram } from "@renovabit/ui/components/branding/logo-monogram";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@renovabit/ui/components/ui/sidebar";
import { Link } from "@tanstack/react-router";
import { useTheme } from "better-themes";

export function NavLogo() {
	const { theme } = useTheme();
	const logoScheme = theme === "dark" ? "light" : "dark";

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton
					size="lg"
					className="p-1.5 [&_svg]:h-full! [&_svg]:w-full! [&_svg]:max-h-none!"
					tooltip="Ir al inicio del panel"
					render={(props) => (
						<Link {...props} preload="intent" to="/">
							<div className="bg-secondary text-secondary-foreground flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg p-0.5">
								<LogoMonogram
									variant={logoScheme}
									aria-hidden
									className="block h-full w-full max-h-full max-w-full shrink-0"
									focusable="false"
									preserveAspectRatio="xMidYMid meet"
								/>
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">Renovabit</span>
								<span className="truncate text-xs text-muted-foreground">Panel ecommerce</span>
							</div>
						</Link>
					)}
				/>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
