import { useSuspenseInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { brandQueries } from "@/features/brands/hooks/queries";
import { useFavoriteStatusMap } from "@/features/favorites/hooks/queries";
import { ProductCard } from "@/features/products/components/product-card";
import { type ProductListFilters, productQueries } from "@/features/products/hooks/queries";
import { Breadcrumbs } from "@/shared/components/breadcrumbs";
import { FilterSidebar } from "@/shared/components/filters/filter-sidebar";
import { InfiniteScrollSentinel } from "@/shared/components/infinite-scroll-sentinel";
import { isApiClientError } from "@/shared/lib/api";
import { getSiteUrl } from "@/shared/lib/env";
import { mapSortToApi } from "@/shared/lib/filters/parsers";
import { type CatalogSearch, normalizeCatalogSearch } from "@/shared/lib/filters/search";
import { useBrandFilterState } from "@/shared/lib/hooks/use-filter-state";
import { breadcrumbJsonLd, seo } from "@/shared/lib/seo";

function buildFilters(brandSlug: string, s: CatalogSearch): ProductListFilters {
	return {
		brands: brandSlug,
		sortBy: mapSortToApi(s.orden),
		minPrice: s.precio_min || undefined,
		maxPrice: s.precio_max || undefined,
	};
}

function buildCanonicalBrandUrl(brandSlug: string, s: CatalogSearch): string {
	const params = new URLSearchParams();
	if (s.orden && s.orden !== "relevance") params.set("orden", s.orden);
	if (s.precio_min) params.set("precio_min", s.precio_min);
	if (s.precio_max) params.set("precio_max", s.precio_max);
	params.sort();
	const qs = params.toString();
	return `${getSiteUrl()}/marca/${brandSlug}${qs ? `?${qs}` : ""}`;
}

export const Route = createFileRoute("/_main/marca/$slug")({
	validateSearch: (s: Record<string, unknown>): CatalogSearch => normalizeCatalogSearch(s, false),

	loaderDeps: ({ search }) => ({
		orden: search.orden,
		precio_min: search.precio_min,
		precio_max: search.precio_max,
	}),
	loader: async ({ params, deps, context: { queryClient } }) => {
		try {
			const filters = buildFilters(params.slug, deps);
			const brand = await queryClient.ensureQueryData(brandQueries.bySlug(params.slug));
			await queryClient.ensureInfiniteQueryData(productQueries.infiniteList(filters));
			return {
				brand,
				canonicalUrl: buildCanonicalBrandUrl(params.slug, deps),
			};
		} catch (error) {
			if (isApiClientError(error) && error.code === "NOT_FOUND_ERROR") {
				throw notFound();
			}
			throw error;
		}
	},

	head: ({ loaderData }) => {
		if (!loaderData?.brand) return {};

		const { brand, canonicalUrl } = loaderData;
		const title = `${brand.name} · Comprar online | Renovabit`;
		const description =
			brand.description ??
			`Explora productos de ${brand.name} en Renovabit con envíos a todo Perú.`;

		const seoTags = seo({ title, description, url: canonicalUrl });

		return {
			meta: [...seoTags.meta],
			links: [{ rel: "canonical", href: canonicalUrl }, ...seoTags.links],
			scripts: [breadcrumbJsonLd([{ name: "Home", url: getSiteUrl() }, { name: brand.name }])],
		};
	},

	component: BrandPage,
});

function BrandPage() {
	const { slug } = Route.useParams();
	const search = Route.useSearch();
	const { data: brand } = useSuspenseQuery(brandQueries.bySlug(slug));
	const filterState = useBrandFilterState();

	const productFilters = useMemo<ProductListFilters>(
		() => buildFilters(slug, search),
		[slug, search],
	);

	const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
		useSuspenseInfiniteQuery(productQueries.infiniteList(productFilters));

	const products = data.pages.flatMap((page) => page.data);
	const totalProducts = data.pages[0]?.total ?? 0;

	const favoriteStatuses = useFavoriteStatusMap(products.map((p) => p.id));

	const hasActiveFilters = !!(
		productFilters.sortBy ||
		productFilters.minPrice ||
		productFilters.maxPrice
	);

	return (
		<div className="flex flex-1 flex-col gap-6 py-6">
			<Breadcrumbs items={[{ name: brand.name }]} />
			<div className="flex items-center gap-4">
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
						{totalProducts} {totalProducts === 1 ? "producto" : "productos"}
					</p>
				</div>
			</div>

			<div className="flex flex-col gap-6 lg:flex-row">
				<FilterSidebar {...filterState} />
				<div className="min-w-0 flex-1 space-y-6">
					{products.length > 0 ? (
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
							{products.map((product) => (
								<div key={product.id}>
									<ProductCard
										product={product}
										isFavorite={favoriteStatuses[product.id] ?? false}
									/>
								</div>
							))}
						</div>
					) : (
						<div className="flex items-center justify-center py-16">
							<p className="text-muted-foreground text-lg">
								{hasActiveFilters
									? "No se encontraron productos con estos filtros."
									: "No hay productos de esta marca aún."}
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
