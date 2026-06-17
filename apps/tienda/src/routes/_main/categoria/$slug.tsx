import { useSuspenseInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createSerializer } from "nuqs";
import { useMemo } from "react";
import { brandQueries } from "@/features/brands/hooks/queries";
import { categoryQueries } from "@/features/categories/hooks/queries";
import { ProductCard } from "@/features/products/components/product-card";
import { type ProductListFilters, productQueries } from "@/features/products/hooks/queries";
import { Breadcrumbs } from "@/shared/components/breadcrumbs";
import { FilterSidebar } from "@/shared/components/filters/filter-sidebar";
import { InfiniteScrollSentinel } from "@/shared/components/infinite-scroll-sentinel";
import { isApiClientError } from "@/shared/lib/api";
import { getSiteUrl } from "@/shared/lib/env";
import { mapSortToApi, productFilterParsers } from "@/shared/lib/filters/parsers";
import { type CatalogSearch, normalizeCatalogSearch } from "@/shared/lib/filters/search";
import { breadcrumbJsonLd, seo } from "@/shared/lib/seo";

const serializeCatalogSearch = createSerializer(productFilterParsers, {
	processUrlSearchParams: (params) => {
		params.sort();
		return params;
	},
});

function buildFilters(categorySlug: string, s: CatalogSearch): ProductListFilters {
	return {
		categorySlug,
		brands: s.marcas || undefined,
		sortBy: mapSortToApi(s.orden),
		minPrice: s.precio_min || undefined,
		maxPrice: s.precio_max || undefined,
	};
}

function buildCanonicalCategoryUrl(categorySlug: string, s: CatalogSearch): string {
	const marcas =
		s.marcas
			?.split(",")
			.map((value) => value.trim())
			.filter(Boolean) ?? [];

	const href = serializeCatalogSearch(`/categoria/${categorySlug}`, {
		marcas: marcas.length > 0 ? marcas : null,
		orden: mapSortToApi(s.orden) ?? null,
		precio_min: s.precio_min || null,
		precio_max: s.precio_max || null,
	});

	return `${getSiteUrl()}${href}`;
}

export const Route = createFileRoute("/_main/categoria/$slug")({
	validateSearch: (s: Record<string, unknown>): CatalogSearch => normalizeCatalogSearch(s, true),

	loaderDeps: ({ search }) => ({
		marcas: search.marcas,
		orden: search.orden,
		precio_min: search.precio_min,
		precio_max: search.precio_max,
	}),
	loader: async ({ params, deps, context: { queryClient } }) => {
		try {
			const filters = buildFilters(params.slug, deps);
			const category = await queryClient.ensureQueryData(categoryQueries.bySlug(params.slug));
			await queryClient.ensureInfiniteQueryData(productQueries.infiniteList(filters));
			void queryClient.prefetchQuery(brandQueries.byCategorySlug(params.slug));

			return {
				category,
				canonicalUrl: buildCanonicalCategoryUrl(params.slug, deps),
			};
		} catch (error) {
			if (isApiClientError(error) && error.code === "NOT_FOUND_ERROR") {
				throw notFound();
			}
			throw error;
		}
	},

	head: ({ loaderData }) => {
		if (!loaderData?.category) return {};

		const { category, canonicalUrl } = loaderData;
		const title = `${category.name} · Comprar online | Renovabit`;
		const description =
			category.description ?? `Explora ${category.name} en Renovabit con envíos a todo Perú.`;

		const seoTags = seo({ title, description, url: canonicalUrl });

		const breadcrumbItems = [
			{ name: "Home", url: getSiteUrl() },
			...category.breadcrumb.map((item) => ({
				name: item.name,
				url: `${getSiteUrl()}/categoria/${item.slug}`,
			})),
		] as Array<{ name: string; url?: string }>;

		return {
			meta: [...seoTags.meta],
			links: [{ rel: "canonical", href: canonicalUrl }, ...seoTags.links],
			scripts: [breadcrumbJsonLd(breadcrumbItems)],
		};
	},

	component: CategoryPage,
});

function CategoryPage() {
	const { slug } = Route.useParams();
	const search = Route.useSearch();
	const { data: category } = useSuspenseQuery(categoryQueries.bySlug(slug));
	const { data: availableBrands = [] } = useSuspenseQuery(brandQueries.byCategorySlug(slug));

	const productFilters = useMemo<ProductListFilters>(
		() => buildFilters(slug, search),
		[slug, search],
	);

	const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
		useSuspenseInfiniteQuery(productQueries.infiniteList(productFilters));

	const products = data.pages.flatMap((page) => page.data);
	const totalProducts = data.pages[0]?.total ?? 0;

	const hasActiveFilters = !!(
		productFilters.brands ||
		productFilters.sortBy ||
		productFilters.minPrice ||
		productFilters.maxPrice
	);

	return (
		<div className="flex flex-1 flex-col gap-6 py-6">
			<Breadcrumbs
				items={category.breadcrumb.map((item) => ({
					name: item.name,
					link: {
						to: "/categoria/$slug",
						params: { slug: item.slug },
						search: {},
					},
				}))}
			/>
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">{category.name}</h1>
				{category.description && (
					<p className="text-muted-foreground max-w-2xl text-base">{category.description}</p>
				)}
				<p className="text-muted-foreground text-sm">
					{totalProducts} {totalProducts === 1 ? "producto" : "productos"}
				</p>
			</div>
			<div className="flex flex-col gap-6 lg:flex-row">
				<FilterSidebar brands={availableBrands} />
				<div className="min-w-0 flex-1 space-y-6">
					{products.length > 0 ? (
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
							{products.map((product) => (
								<div key={product.id}>
									<ProductCard product={product} />
								</div>
							))}
						</div>
					) : (
						<div className="flex items-center justify-center py-16">
							<p className="text-muted-foreground text-lg">
								{hasActiveFilters
									? "No se encontraron productos con estos filtros."
									: "No hay productos en esta categoría aún."}
							</p>
						</div>
					)}
					<InfiniteScrollSentinel
						hasNextPage={hasNextPage}
						isFetching={isFetching}
						isFetchingNextPage={isFetchingNextPage}
						fetchNextPage={fetchNextPage}
					/>
				</div>
			</div>
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
