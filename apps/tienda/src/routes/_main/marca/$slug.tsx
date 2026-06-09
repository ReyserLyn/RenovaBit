import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { brandQueries } from "@/features/brands/hooks/queries";
import { ProductCard } from "@/features/products/components/product-card";
import { productQueries } from "@/features/products/hooks/queries";
import { FilterSidebar } from "@/shared/components/filters/filter-sidebar";
import { isApiClientError } from "@/shared/lib/api";
import { getSiteUrl } from "@/shared/lib/env";
import { seo } from "@/shared/lib/seo";

export const Route = createFileRoute("/_main/marca/$slug")({
	loader: async ({ params, context: { queryClient } }) => {
		try {
			const [brand] = await Promise.all([
				queryClient.ensureQueryData(brandQueries.bySlug(params.slug)),
				queryClient.ensureQueryData(productQueries.byBrandSlug(params.slug)),
			]);
			return { brand };
		} catch (error) {
			if (isApiClientError(error) && error.code === "NOT_FOUND_ERROR") {
				throw notFound();
			}
			throw error;
		}
	},

	head: ({ loaderData }) => {
		if (!loaderData?.brand) return {};
		const { brand } = loaderData;
		return {
			meta: [
				...seo({
					title: `${brand.name} — Productos y precios | Renovabit`,
					description:
						brand.description ??
						`Productos de la marca ${brand.name} en Renovabit. Envíos a todo Perú. ${brand.productCount} productos disponibles.`,
				}),
			],
		};
	},

	component: BrandPage,
});

function BrandPage() {
	const { slug } = Route.useParams();
	const { data: brand } = useSuspenseQuery(brandQueries.bySlug(slug));
	const { data: products } = useSuspenseQuery(productQueries.byBrandSlug(slug));

	return (
		<div className="flex flex-1 flex-col gap-6 py-6">
			{/* Header */}
			<div className="animate-fade-in-up flex items-center gap-4">
				{brand.imageUrl && (
					<img
						src={brand.imageUrl}
						alt={brand.name}
						className="size-16 rounded-lg object-contain bg-muted"
					/>
				)}
				<div className="space-y-1">
					<h1 className="text-3xl font-bold tracking-tight">{brand.name}</h1>
					{brand.description && (
						<p className="text-muted-foreground max-w-2xl text-base">{brand.description}</p>
					)}
					<p className="text-muted-foreground text-sm">
						{brand.productCount} {brand.productCount === 1 ? "producto" : "productos"}
					</p>
				</div>
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
						<p className="text-muted-foreground text-lg">No hay productos de esta marca aún.</p>
					</div>
				)}
			</div>

			{/* Structured Data: Brand */}
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify({
						"@context": "https://schema.org",
						"@type": "Brand",
						name: brand.name,
						description: brand.description,
						logo: brand.imageUrl,
						url: `${getSiteUrl()}/marca/${brand.slug}`,
					}),
				}}
			/>
		</div>
	);
}
