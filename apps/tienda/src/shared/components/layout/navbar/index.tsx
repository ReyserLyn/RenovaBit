import { LogoHorizontalLight } from "@renovabit/ui/components/branding/logo-horizontal-light";
import { NavigationMenu, NavigationMenuList } from "@renovabit/ui/components/ui/navigation-menu";
import { Link } from "@tanstack/react-router";
import { ButtonActions } from "./button-actions";
import { ButtonAuth } from "./button-auth";
import ButtonCart from "./button-cart";
import InputSearch from "./input-search";
import { MenuBrand } from "./menu-brand";
import { MenuCategory } from "./menu-category";
import { MenuInfo } from "./menu-info";

export default function Navbar() {
	return (
		<nav className="flex w-full flex-col items-center gap-4 py-4">
			<div className="flex w-full items-center gap-4 justify-between">
				{/* <SidebarToggle /> */}

				<Link to="/">
					<LogoHorizontalLight className="w-[170px] md:w-[200px]" />
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
