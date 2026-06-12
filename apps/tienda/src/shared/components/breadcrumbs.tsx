import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@renovabit/ui/components/ui/breadcrumb";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

export interface BreadcrumbItemData {
	name: string;
	link?: {
		to: string;
		params?: Record<string, string>;
		search?: Record<string, string>;
	};
}

interface BreadcrumbsProps {
	items: BreadcrumbItemData[];
	className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
	return (
		<Breadcrumb className={className}>
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink render={<Link to="/" />}>Inicio</BreadcrumbLink>
				</BreadcrumbItem>
				{items.map((item, i) => {
					const isLast = i === items.length - 1;
					return (
						<Fragment key={`${item.name}-${i}`}>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								{isLast || !item.link ? (
									<BreadcrumbPage>{item.name}</BreadcrumbPage>
								) : (
									<BreadcrumbLink
										render={
											<Link to={item.link.to} params={item.link.params} search={item.link.search} />
										}
									>
										{item.name}
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
						</Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
