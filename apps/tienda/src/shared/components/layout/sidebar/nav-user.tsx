import { Login01Icon, Moon02Icon, Sun01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@renovabit/ui/components/ui/sidebar";
import { Link } from "@tanstack/react-router";
import { useTheme } from "better-themes";
import { useState } from "react";
import { AnimatedThemeToggler } from "@/shared/components/layout/theme-toggle";

export function NavUser() {
	const { setOpenMobile } = useSidebar();
	const { setTheme } = useTheme();
	const [isDark, setIsDark] = useState(false);

	return (
		<SidebarMenu>
			{/* Theme toggle */}
			<SidebarMenuItem>
				<AnimatedThemeToggler
					variant="circle"
					layout="custom"
					onThemeChange={(dark) => {
						setIsDark(dark);
						setTheme(dark ? "dark" : "light");
					}}
					className="flex h-12 w-full cursor-pointer items-center gap-2 rounded-md p-2 text-sm font-medium outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&_svg]:size-4"
				>
					<div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
						<HugeiconsIcon icon={isDark ? Moon02Icon : Sun01Icon} className="size-4" />
					</div>
					<div className="grid flex-1 text-left text-sm leading-tight">
						<span className="truncate font-medium">Tema</span>
						<span className="truncate text-xs text-muted-foreground">
							{isDark ? "Oscuro" : "Claro"}
						</span>
					</div>
				</AnimatedThemeToggler>
			</SidebarMenuItem>

			{/* Auth */}
			<SidebarMenuItem>
				<SidebarMenuButton
					size="lg"
					className="text-primary"
					tooltip="Iniciar sesión"
					render={(props) => (
						<Link
							{...props}
							preload="intent"
							to="/iniciar-sesion"
							onClick={() => setOpenMobile(false)}
						>
							<div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
								<HugeiconsIcon icon={Login01Icon} className="size-4" />
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-semibold">Iniciar Sesión</span>
								<span className="truncate text-xs text-muted-foreground">Accede a tu cuenta</span>
							</div>
						</Link>
					)}
				/>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
