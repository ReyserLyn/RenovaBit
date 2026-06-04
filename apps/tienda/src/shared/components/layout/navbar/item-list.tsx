import { NavigationMenuLink } from "@renovabit/ui/components/ui/navigation-menu";
import { cn } from "@renovabit/ui/lib/utils";
import { Link } from "@tanstack/react-router";

export function ItemList({
	className,
	title,
	href,
	...props
}: React.ComponentPropsWithoutRef<"li"> & { href: string }) {
	return (
		<li {...props}>
			<NavigationMenuLink
				render={
					<Link
						to={href}
						className={cn(
							"block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground ",
							className,
						)}
					>
						<div className="flex items-center gap-2 leading-none tracking-tight">{title}</div>
					</Link>
				}
			></NavigationMenuLink>
		</li>
	);
}
