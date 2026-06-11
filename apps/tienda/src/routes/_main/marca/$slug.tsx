import { useSuspenseInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createSerializer } from "nuqs";
import { useMemo } from "react";
import { brandQueries } from "@/features/brands/hooks/queries";
import { ProductCard } from "@/features/products/components/product-card";
import { type ProductListFilters, productQueries } from "@/features/products/hooks/queries";
import { FilterSidebar } from "@/shared/components/filters/filter-sidebar";
import { InfiniteScrollSentinel } from "@/shared/components/infinite-scroll-sentinel";
import { isApiClientError } from "@/shared/lib/api";
import { getSiteUrl } from "@/shared/lib/env";
import { mapSortToApi, productFilterParsers } from "@/shared/lib/filters/parsers";
import { type CatalogSearch, normalizeCatalogSearch } from "@/shared/lib/filters/search";
import { seo } from "@/shared/lib/seo";

const serializeCatalogSearch = createSerializer(productFilterParsers, {
	processUrlSearchParams: (params) => {
		params.sort();
		return params;
	},
});

function buildFilters(brandSlug: string, s: CatalogSearch): ProductListFilters {
	return {
		brands: brandSlug,
		sortBy: mapSortToApi(s.orden),
		minPrice: s.precio_min || undefined,
		maxPrice: s.precio_max || undefined,
	};
}

function buildCanonicalBrandUrl(brandSlug: string, s: CatalogSearch): string {
	const href = serializeCatalogSearch(`/marca/${brandSlug}`, {
		orden: mapSortToApi(s.orden) ?? null,
		precio_min: s.precio_min || null,
		precio_max: s.precio_max || null,
		marcas: null,
	});

	return `${getSiteUrl()}${href}`;
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

		const title = `${loaderData.brand.name} · Comprar online | Renovabit`;
		const description =
			loaderData.brand.description ??
			`Explora productos de ${loaderData.brand.name} en Renovabit con envíos a todo Perú.`;

		return {
			meta: [...seo({ title, description })],
			links: [{ rel: "canonical", href: loaderData.canonicalUrl }],
		};
	},

	component: BrandPage,
});

function BrandPage() {
	const { slug } = Route.useParams();
	const search = Route.useSearch();
	const { data: brand } = useSuspenseQuery(brandQueries.bySlug(slug));

	const productFilters = useMemo<ProductListFilters>(
		() => buildFilters(slug, search),
		[slug, search],
	);

	const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
		useSuspenseInfiniteQuery(productQueries.infiniteList(productFilters));

	const products = data.pages.flatMap((page) => page.data);
	const totalProducts = data.pages[0]?.total ?? 0;

	const hasActiveFilters = !!(
		productFilters.sortBy ||
		productFilters.minPrice ||
		productFilters.maxPrice
	);

	return (
		<div className="flex flex-1 flex-col gap-6 py-6">
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
				<div>
					<FilterSidebar />
				</div>
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
