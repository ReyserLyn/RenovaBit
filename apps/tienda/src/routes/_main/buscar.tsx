import { useSuspenseInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { brandQueries } from "@/features/brands/hooks/queries";
import { ProductCard } from "@/features/products/components/product-card";
import type { ProductListItem } from "@/features/products/types";
import { type SearchFilters, searchQueries } from "@/features/search/hooks/queries";
import { FilterSidebar } from "@/shared/components/filters/filter-sidebar";
import { InfiniteScrollSentinel } from "@/shared/components/infinite-scroll-sentinel";
import { isApiClientError } from "@/shared/lib/api";
import { getSiteUrl } from "@/shared/lib/env";
import { mapSortToApi } from "@/shared/lib/filters/parsers";
import { type CatalogSearch, normalizeCatalogSearch } from "@/shared/lib/filters/search";
import { seo } from "@/shared/lib/seo";

type BuscarSearch = CatalogSearch & {
	q: string;
};

function buildSearchFilters(q: string, s: CatalogSearch): SearchFilters {
	return {
		q,
		brands: s.marcas || undefined,
		sortBy: mapSortToApi(s.orden),
		minPrice: s.precio_min || undefined,
		maxPrice: s.precio_max || undefined,
	};
}

export const Route = createFileRoute("/_main/buscar")({
	validateSearch: (s: Record<string, unknown>): BuscarSearch => ({
		...normalizeCatalogSearch(s, true),
		q: typeof s.q === "string" ? s.q : "",
	}),

	loaderDeps: ({ search }) => ({
		q: search.q,
		marcas: search.marcas,
		orden: search.orden,
		precio_min: search.precio_min,
		precio_max: search.precio_max,
	}),

	loader: async ({ deps, context: { queryClient } }) => {
		const q = deps.q.trim();
		if (!q) return { q };

		try {
			const filters = buildSearchFilters(q, deps);
			// SSR: await BOTH queries so the page renders with data on first paint.
			// Mirrors the category-page pattern at /categoria/$slug — use useSuspenseQuery
			// + await the prefetch; never `void` a query whose absence on first paint
			// would leave a hole in the layout.
			await queryClient.ensureInfiniteQueryData(searchQueries.infiniteResults(filters));
			await queryClient.ensureQueryData(brandQueries.bySearchTerm({ q }));
			return { q };
		} catch (error) {
			if (isApiClientError(error)) {
				return { q, error: error.message };
			}
			throw error;
		}
	},

	head: ({ loaderData }) => {
		const q = loaderData?.q ?? "";
		const hasQuery = q.length > 0;

		if (!hasQuery) {
			return {
				meta: [
					...seo({
						title: "Buscar productos \u00b7 Renovabit",
						description:
							"Encuentra componentes de PC en Renovabit. Explora nuestro cat\u00e1logo de productos con env\u00edos a todo Per\u00fa.",
					}),
					{ name: "robots", content: "noindex, follow" },
					{ property: "og:locale", content: "es_PE" },
				],
				links: [{ rel: "canonical", href: `${getSiteUrl()}/buscar` }],
			};
		}

		const title = `Resultados para '${q}' | Renovabit`;
		const description = `Busca "${q}" en Renovabit. Encuentra componentes de PC al mejor precio con env\u00edos a todo Per\u00fa.`;
		const robots = "noindex, follow";

		return {
			meta: [
				...seo({ title, description }),
				{ name: "robots", content: robots },
				{ property: "og:locale", content: "es_PE" },
				{ property: "og:url", content: `${getSiteUrl()}/buscar?q=${encodeURIComponent(q)}` },
			],
			links: [
				{
					rel: "canonical",
					href: `${getSiteUrl()}/buscar?q=${encodeURIComponent(q)}`,
				},
			],
		};
	},

	component: BuscarPage,

	errorComponent: ({ error, reset }) => {
		const errorMessage = isApiClientError(error)
			? error.message
			: "Ocurri\u00f3 un error inesperado";
		if (!isApiClientError(error)) {
			console.error("[buscar] Unexpected error:", error);
		}
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
				<h1 className="text-2xl font-bold tracking-tight">Error en la b\u00fasqueda</h1>
				<p className="text-muted-foreground mt-2">{errorMessage}</p>
				<button
					type="button"
					onClick={() => reset()}
					className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				>
					Intentar de nuevo
				</button>
			</div>
		);
	},
});

function BuscarPage() {
	const { error: loaderError } = Route.useLoaderData();
	const search = Route.useSearch();
	const currentQuery = search.q.trim();

	// Loader error state
	if (loaderError) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center p-4">
				<h1 className="text-2xl font-bold tracking-tight">Error en la b\u00fasqueda</h1>
				<p className="text-muted-foreground mt-2">{loaderError}</p>
			</div>
		);
	}

	// Show feedback for short queries
	if (currentQuery.length === 1) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center p-4">
				<h1 className="text-2xl font-bold tracking-tight">Buscar productos</h1>
				<p className="text-muted-foreground mt-2">Ingresa al menos 2 caracteres</p>
			</div>
		);
	}

	// Empty query state
	if (!currentQuery) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center p-4">
				<h1 className="text-2xl font-bold tracking-tight">Buscar productos</h1>
				<p className="text-muted-foreground mt-2">Ingresa un t\u00e9rmino de b\u00fasqueda</p>
			</div>
		);
	}

	return <SearchResults q={currentQuery} search={search} />;
}

function SearchResults({ q, search }: { q: string; search: BuscarSearch }) {
	const filters = useMemo<SearchFilters>(
		() => buildSearchFilters(q, search),
		[q, search.marcas, search.orden, search.precio_min, search.precio_max],
	);

	// SSR: both queries are awaited in the loader (products AND brands) and consumed
	// here via useSuspenseQuery / useSuspenseInfiniteQuery. No `useQuery` with
	// placeholderData — that's what caused the "all brands then filtered" flash.
	const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
		useSuspenseInfiniteQuery(searchQueries.infiniteResults(filters));
	const { data: brands } = useSuspenseQuery(brandQueries.bySearchTerm({ q }));

	const products = data.pages.flatMap((page) => page.data);
	const totalProducts = data.pages[0]?.total ?? 0;

	const hasActiveFilters = !!(
		filters.brands ||
		filters.sortBy ||
		filters.minPrice ||
		filters.maxPrice
	);

	// Map API ProductSearchResult → ProductListItem for ProductCard
	const mappedProducts = useMemo<ProductListItem[]>(
		() =>
			products.map((p) => ({
				id: p.id,
				name: p.name,
				slug: p.slug,
				price: p.price,
				stock: p.stock,
				sku: p.sku,
				isFeatured: p.isFeatured,
				primaryImage: p.primaryImage,
				brand: p.brand ? { id: p.brand.slug, name: p.brand.name, slug: p.brand.slug } : null,
				category: p.category
					? { id: p.category.slug, name: p.category.name, slug: p.category.slug }
					: null,
				headline: p.headline,
				isInStock: p.isInStock,
			})),
		[products],
	);

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "ItemList",
		numberOfItems: totalProducts,
		itemListOrder: "https://schema.org/ItemListUnordered",
		itemListElement: products.slice(0, 10).map((product, i) => ({
			"@type": "ListItem",
			position: i + 1,
			item: {
				"@type": "Product",
				name: product.name,
				url: `${getSiteUrl()}/producto/${product.slug}`,
				...(product.primaryImage ? { image: product.primaryImage.url } : {}),
				...(product.brand ? { brand: { "@type": "Brand", name: product.brand.name } } : {}),
				offers: {
					"@type": "Offer",
					price: product.price,
					priceCurrency: "PEN",
					availability: product.isInStock
						? "https://schema.org/InStock"
						: "https://schema.org/OutOfStock",
				},
			},
		})),
	};

	return (
		<div className="flex flex-1 flex-col gap-6 py-6">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">Resultados para: {q}</h1>
				<p className="text-muted-foreground text-sm">
					{totalProducts} {totalProducts === 1 ? "producto" : "productos"} encontrados
				</p>
			</div>

			<div className="flex flex-col gap-6 lg:flex-row">
				<FilterSidebar brands={brands} />
				<div className="min-w-0 flex-1 space-y-6">
					{products.length > 0 ? (
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
							{mappedProducts.map((product) => (
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
									: "No hay productos para esta búsqueda."}
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
					__html: JSON.stringify(jsonLd).replace(/<\//g, "<\\/"),
				}}
			/>
		</div>
	);
}
