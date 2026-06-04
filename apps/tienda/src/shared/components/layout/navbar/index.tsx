import { LogoHorizontal } from "@renovabit/ui/components/branding";
import { NavigationMenu, NavigationMenuList } from "@renovabit/ui/components/ui/navigation-menu";
import { SidebarTrigger } from "@renovabit/ui/components/ui/sidebar";
import { Link } from "@tanstack/react-router";
import { useTheme } from "better-themes";
import { ButtonActions } from "./button-actions";
import { ButtonAuth } from "./button-auth";
import ButtonCart from "./button-cart";
import InputSearch from "./input-search";
import { MenuBrand } from "./menu-brand";
import { MenuCategory } from "./menu-category";
import { MenuInfo } from "./menu-info";

export default function Navbar() {
	const { theme } = useTheme();
	const logoScheme = theme === "dark" ? "dark" : "light";

	return (
		<nav className="flex w-full flex-col items-center gap-4 py-4">
			<div className="flex w-full items-center gap-4 justify-between">
				<SidebarTrigger className="-ms-1 md:hidden" />

				<Link to="/">
					<LogoHorizontal variant={logoScheme} className="w-[170px] md:w-[200px]" />
				</Link>

				<InputSearch className="hidden w-full max-w-xl md:block" />

				<div className="flex items-center gap-4">
					<ButtonCart />

					<ButtonAuth />
				</div>
			</div>

			<div className="flex w-full items-center justify-between gap-4">
				<InputSearch className="block w-full max-w-xl md:hidden" />

				<NavigationMenu className="hidden md:flex">
					<NavigationMenuList className="gap-1">
						<MenuCategory />

						<MenuBrand />

						<MenuInfo />
					</NavigationMenuList>
				</NavigationMenu>

				<ButtonActions />
			</div>
		</nav>
	);
}
