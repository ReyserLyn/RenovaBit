import { useSuspenseInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { brandQueries } from "@/features/brands/hooks/queries";
import { categoryQueries } from "@/features/categories/hooks/queries";
import { getLeafCategories, type LeafCategory } from "@/features/categories/leaves";
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
import { useProductsFilterState } from "@/shared/lib/hooks/use-filter-state";
import { seo } from "@/shared/lib/seo";

function buildFilters(s: CatalogSearch): ProductListFilters {
	return {
		// multi-select: comma-separated slugs (hojas, sin parents)
		categories: s.categorias || undefined,
		brands: s.marcas || undefined,
		sortBy: mapSortToApi(s.orden),
		minPrice: s.precio_min || undefined,
		maxPrice: s.precio_max || undefined,
	};
}

/**
 * Canonical always points to the clean listing path: filter/sort/price
 * variations are facets of the same page and must not create duplicates.
 */
function buildCanonicalUrl(): string {
	return `${getSiteUrl()}/productos`;
}

export const Route = createFileRoute("/_main/productos")({
	validateSearch: (s: Record<string, unknown>): CatalogSearch => normalizeCatalogSearch(s, true),

	loaderDeps: ({ search }) => ({
		marcas: search.marcas,
		categorias: search.categorias,
		orden: search.orden,
		precio_min: search.precio_min,
		precio_max: search.precio_max,
	}),
	loader: async ({ deps, context: { queryClient } }) => {
		try {
			const filters = buildFilters(deps);
			// Filtrado bidireccional: pasar el otro filtro a cada query
			await Promise.all([
				queryClient.ensureQueryData(categoryQueries.tree({ brands: deps.marcas })),
				queryClient.ensureQueryData(brandQueries.list({ categories: deps.categorias })),
				queryClient.ensureInfiniteQueryData(productQueries.infiniteList(filters)),
			]);
			return { canonicalUrl: buildCanonicalUrl() };
		} catch (error) {
			if (isApiClientError(error)) throw error;
			throw error;
		}
	},

	head: ({ loaderData }) => {
		if (!loaderData) return {};
		const { canonicalUrl } = loaderData;
		const title = "Todos los productos · Comprar online | RenovaBit";
		const description =
			"Explora el catálogo completo de RenovaBit: laptops, componentes, periféricos y más. Envíos a todo Perú desde Arequipa.";

		const seoTags = seo({ title, description, url: canonicalUrl });
		return {
			meta: [
				...seoTags.meta,
				{ property: "og:url", content: canonicalUrl },
				{ property: "og:image", content: `${getSiteUrl()}/og-default.png` },
			],
			links: [{ rel: "canonical", href: canonicalUrl }, ...seoTags.links],
		};
	},

	component: ProductsPage,
});

function ProductsPage() {
	const search = Route.useSearch();
	const { data: tree } = useSuspenseQuery(categoryQueries.tree({ brands: search.marcas }));
	const { data: allBrands = [] } = useSuspenseQuery(
		brandQueries.list({ categories: search.categorias }),
	);
	const filterState = useProductsFilterState();

	// Solo hojas (sin parents) para evitar duplicados en el filtro multi-select
	const leafCategories = useMemo<LeafCategory[]>(() => getLeafCategories(tree), [tree]);

	const productFilters = useMemo<ProductListFilters>(() => buildFilters(search), [search]);

	const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
		useSuspenseInfiniteQuery(productQueries.infiniteList(productFilters));

	const products = data.pages.flatMap((page) => page.data);
	const totalProducts = data.pages[0]?.total ?? 0;

	const favoriteStatuses = useFavoriteStatusMap(products.map((p) => p.id));

	const hasActiveFilters = !!(
		productFilters.categories ||
		productFilters.brands ||
		productFilters.sortBy ||
		productFilters.minPrice ||
		productFilters.maxPrice
	);

	return (
		<div className="flex flex-1 flex-col gap-6 py-6">
			<Breadcrumbs
				items={[
					{
						name: "Inicio",
						link: { to: "/", search: {} },
					},
					{
						name: "Productos",
						link: { to: "/productos", search: {} },
					},
				]}
			/>

			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">Todos los productos</h1>
				<p className="text-muted-foreground text-sm">
					{totalProducts} {totalProducts === 1 ? "producto" : "productos"} en el catálogo
				</p>
			</div>

			<div className="flex flex-col gap-6 lg:flex-row">
				<FilterSidebar brands={allBrands} categories={leafCategories} {...filterState} />
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
									: "No hay productos disponibles aún."}
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
		</div>
	);
}
