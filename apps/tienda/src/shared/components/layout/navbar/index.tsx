import { NavigationMenu, NavigationMenuList } from "@renovabit/ui/components/ui/navigation-menu";
import { SidebarTrigger } from "@renovabit/ui/components/ui/sidebar";
import { Link } from "@tanstack/react-router";
import { useTheme } from "better-themes";
import { AnimatedThemeToggler } from "@/shared/components/layout/theme-toggle";
import { ButtonActions } from "./button-actions";
import ButtonCart from "./button-cart";
import InputSearch from "./input-search";
import { MenuBrand } from "./menu-brand";
import { MenuCategory } from "./menu-category";
import { MenuInfo } from "./menu-info";
import { UserMenu } from "./user-menu";

export default function Navbar() {
	const { setTheme } = useTheme();

	return (
		<nav className="flex w-full flex-col items-center gap-4 py-4">
			<div className="flex w-full items-center gap-4 justify-between">
				<SidebarTrigger className="-ms-1 md:hidden" />

				<Link to="/">
					<img
						src="/logo-light.svg"
						alt="Renovabit"
						width="200"
						height="49"
						fetchPriority="high"
						className="h-auto w-[170px] dark:hidden md:w-[200px]"
					/>
					<img
						src="/logo-dark.svg"
						alt="Renovabit"
						width="200"
						height="49"
						fetchPriority="high"
						className="hidden h-auto w-[170px] dark:block md:w-[200px]"
					/>
				</Link>

				<InputSearch className="hidden w-full max-w-xl md:block" />

				<div className="flex items-center gap-4">
					<AnimatedThemeToggler
						variant="circle"
						className="items-center justify-center text-accent-foreground transition-all duration-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 h-8 w-8 cursor-pointer hover:bg-accent rounded-full p-1.5 hidden md:flex"
						onThemeChange={(dark) => setTheme(dark ? "dark" : "light")}
					/>

					<ButtonCart />

					<UserMenu />
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
