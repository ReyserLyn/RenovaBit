import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { categoryQueries } from "@/features/categories/hooks/queries";
import { ProductCard } from "@/features/products/components/product-card";
import { productQueries } from "@/features/products/hooks/queries";
import { FilterSidebar } from "@/shared/components/filters/filter-sidebar";
import { isApiClientError } from "@/shared/lib/api";
import { getSiteUrl } from "@/shared/lib/env";
import { seo } from "@/shared/lib/seo";

export const Route = createFileRoute("/_main/categoria/$slug")({
	loader: async ({ params, context: { queryClient } }) => {
		try {
			const [category] = await Promise.all([
				queryClient.ensureQueryData(categoryQueries.bySlug(params.slug)),
				queryClient.ensureQueryData(productQueries.byCategorySlug(params.slug)),
			]);
			return { category };
		} catch (error) {
			if (isApiClientError(error) && error.code === "NOT_FOUND_ERROR") {
				throw notFound();
			}
			throw error;
		}
	},

	head: ({ loaderData }) => {
		if (!loaderData?.category) return {};
		const { category } = loaderData;
		return {
			meta: [
				...seo({
					title: `${category.name} — Comprar online | Renovabit`,
					description:
						category.description ??
						`Compra ${category.name} al mejor precio en Renovabit. Envíos a todo Perú. ${category.productCount} productos disponibles.`,
				}),
			],
		};
	},

	component: CategoryPage,
});

function CategoryPage() {
	const { slug } = Route.useParams();
	const { data: category } = useSuspenseQuery(categoryQueries.bySlug(slug));
	const { data: products } = useSuspenseQuery(productQueries.byCategorySlug(slug));

	return (
		<div className="flex flex-1 flex-col gap-6 py-6">
			{/* Breadcrumb */}
			<div className="animate-fade-in">
				<Breadcrumb items={category.breadcrumb} />
			</div>

			{/* Header */}
			<div className="animate-fade-in-up space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">{category.name}</h1>
				{category.description && (
					<p className="text-muted-foreground max-w-2xl text-base">{category.description}</p>
				)}
				<p className="text-muted-foreground text-sm">
					{category.productCount} {category.productCount === 1 ? "producto" : "productos"}
				</p>
			</div>

			{/* Content: Filters + Grid */}
			<div className="flex flex-col gap-6 lg:flex-row">
				{/* Filtros */}
				<div className="animate-fade-in">
					<FilterSidebar />
				</div>

				{/* Product Grid */}
				{products.length > 0 ? (
					<div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
						{products.map((product, i) => (
							<div
								key={product.id}
								className="animate-fade-in-up"
								style={{ animationDelay: `${(i % 8) * 50}ms` }}
							>
								<ProductCard product={product} />
							</div>
						))}
					</div>
				) : (
					<div className="animate-fade-in flex flex-1 items-center justify-center py-16">
						<p className="text-muted-foreground text-lg">No hay productos en esta categoría aún.</p>
					</div>
				)}
			</div>

			{/* Structured Data: BreadcrumbList */}
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify({
						"@context": "https://schema.org",
						"@type": "BreadcrumbList",
						itemListElement: category.breadcrumb.map((item, i) => ({
							"@type": "ListItem",
							position: i + 1,
							name: item.name,
							item: `${getSiteUrl()}/categoria/${item.slug}`,
						})),
					}),
				}}
			/>
		</div>
	);
}

/** Breadcrumb interno visible (UI) */
function Breadcrumb({ items }: { items: Array<{ id: string; name: string; slug: string }> }) {
	return (
		<nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
			<Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
				Inicio
			</Link>
			{items.map((item) => (
				<span key={item.id} className="flex items-center gap-1.5">
					<HugeiconsIcon icon={ArrowRight01Icon} size={14} className="text-muted-foreground/50" />
					{item.slug === items[items.length - 1]?.slug ? (
						<span className="font-medium">{item.name}</span>
					) : (
						<Link
							to="/categoria/$slug"
							params={{ slug: item.slug }}
							className="text-muted-foreground hover:text-foreground transition-colors"
						>
							{item.name}
						</Link>
					)}
				</span>
			))}
		</nav>
	);
}
