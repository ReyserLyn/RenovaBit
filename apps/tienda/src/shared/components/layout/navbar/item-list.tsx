import { NavigationMenuLink } from "@renovabit/ui/components/ui/navigation-menu";
import { cn } from "@renovabit/ui/lib/utils";
import { Link } from "@tanstack/react-router";

export function ItemList({
	className,
	title,
	href,
	...props
}: React.ComponentPropsWithoutRef<"li"> & { href: string }) {
	const linkClassName = cn(
		"block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground ",
		className,
	);
	const content = (
		<div className="flex items-center gap-2 leading-none tracking-tight">{title}</div>
	);
	const isExternal = href.startsWith("http");

	return (
		<li {...props}>
			<NavigationMenuLink
				render={
					isExternal ? (
						<a href={href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
							{content}
						</a>
					) : (
						<Link to={href} className={linkClassName}>
							{content}
						</Link>
					)
				}
			></NavigationMenuLink>
		</li>
	);
}
