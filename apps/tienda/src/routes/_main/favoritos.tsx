import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@renovabit/ui/components/ui/empty";
import { buttonVariants } from "@renovabit/ui/lib/button-variants";
import { cn } from "@renovabit/ui/lib/utils";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { favoritesQueries } from "@/features/favorites/hooks/queries";
import { ProductCard } from "@/features/products/components/product-card";
import type { ProductListItem } from "@/features/products/types";
import { FilterSidebar } from "@/shared/components/filters/filter-sidebar";
import { InfiniteScrollSentinel } from "@/shared/components/infinite-scroll-sentinel";
import { isApiClientError } from "@/shared/lib/api";
import { authSessionQueryOptions } from "@/shared/lib/auth/auth-session";
import { getSiteUrl } from "@/shared/lib/env";
import { mapSortToApi } from "@/shared/lib/filters/parsers";
import { type CatalogSearch, normalizeCatalogSearch } from "@/shared/lib/filters/search";
import { useFavoritesFilterState } from "@/shared/lib/hooks/use-filter-state";
import { seo } from "@/shared/lib/seo";

type FavoritosSearch = CatalogSearch;

function buildFavoritesFilters(s: CatalogSearch) {
	return {
		sortBy: mapSortToApi(s.orden),
		brands: s.marcas || undefined,
		minPrice: s.precio_min || undefined,
		maxPrice: s.precio_max || undefined,
	};
}

export const Route = createFileRoute("/_main/favoritos")({
	validateSearch: (s: Record<string, unknown>): FavoritosSearch => ({
		...normalizeCatalogSearch(s, true),
	}),

	loaderDeps: ({ search }) => ({
		marcas: search.marcas,
		orden: search.orden,
		precio_min: search.precio_min,
		precio_max: search.precio_max,
	}),

	loader: async ({ deps, context: { queryClient } }) => {
		try {
			const session = await queryClient.fetchQuery(authSessionQueryOptions());
			const isLoggedIn = !!session?.user;

			if (isLoggedIn) {
				const filters = buildFavoritesFilters(deps);
				await queryClient.ensureInfiniteQueryData(favoritesQueries.infinite(filters));
				return { isLoggedIn: true };
			}

			return { isLoggedIn: false };
		} catch (error) {
			if (isApiClientError(error)) {
				return { isLoggedIn: false, error: error.message };
			}
			throw error;
		}
	},

	head: () => ({
		meta: [
			...seo({
				title: "Mis Favoritos · Renovabit",
				description:
					"Tu lista de productos favoritos en Renovabit. Encuentra componentes de PC al mejor precio con envíos a todo Perú.",
			}).meta,
			{ name: "robots", content: "noindex, follow" },
			{ property: "og:locale", content: "es_PE" },
			{ property: "og:url", content: `${getSiteUrl()}/favoritos` },
		],
		links: [{ rel: "canonical", href: `${getSiteUrl()}/favoritos` }],
	}),

	component: FavoritosPage,
});

function FavoritosPage() {
	const { isLoggedIn, error: loaderError } = Route.useLoaderData();
	const search = Route.useSearch();

	if (loaderError) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center p-4">
				<h1 className="text-2xl font-bold tracking-tight">Error</h1>
				<p className="text-muted-foreground mt-2">{loaderError}</p>
			</div>
		);
	}

	if (!isLoggedIn) {
		return <FavoritesLoginPrompt />;
	}

	return <FavoritesContent search={search} />;
}

function FavoritesLoginPrompt() {
	return (
		<Empty className="py-20">
			<EmptyHeader>
				<EmptyTitle>Mis Favoritos</EmptyTitle>
				<EmptyDescription>
					Inicia sesión para ver tus productos favoritos y acceder a ellos desde cualquier
					dispositivo.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent className="flex flex-col md:flex-row justify-center items-center gap-4">
				<Link
					to="/iniciar-sesion"
					className={cn(buttonVariants({ variant: "default", size: "lg" }), "px-6")}
				>
					Iniciar sesión
				</Link>
				<Link
					to="/registrarse"
					className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-6")}
				>
					Crear cuenta
				</Link>
			</EmptyContent>
		</Empty>
	);
}

function FavoritesContent({ search }: { search: FavoritosSearch }) {
	const filters = useMemo<ReturnType<typeof buildFavoritesFilters>>(
		() => buildFavoritesFilters(search),
		[search.marcas, search.orden, search.precio_min, search.precio_max, search],
	);

	const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
		useSuspenseInfiniteQuery({
			...favoritesQueries.infinite(filters),
		});

	const products = data?.pages.flatMap((page) => (page ? page.data : [])) ?? [];
	const totalProducts = data?.pages[0]?.total ?? 0;
	const brands = data?.pages[0]?.brands ?? [];
	const filterState = useFavoritesFilterState();

	const mappedProducts = useMemo<ProductListItem[]>(
		() =>
			products.map((item) => ({
				id: item.productId,
				name: item.productName,
				slug: item.productSlug,
				price: item.price,
				stock: item.stock,
				sku: item.productSku,
				isFeatured: false,
				primaryImage: item.primaryImage,
				brand: item.brand,
				category: item.category,
				isInStock: item.isInStock,
			})),
		[products],
	);

	const resultsLabel =
		products.length > 0
			? `${totalProducts} ${totalProducts === 1 ? "favorito" : "favoritos"}`
			: "No tienes favoritos aún";

	return (
		<div className="flex flex-1 flex-col gap-6 py-6">
			{/* ── Header ────────────────────────────── */}
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">Mis Favoritos</h1>
				<p
					role="status"
					aria-live="polite"
					aria-atomic="true"
					className="text-muted-foreground text-sm"
				>
					{resultsLabel}
				</p>
			</div>

			{/* ── Content ───────────────────────────── */}
			<div className="flex flex-col gap-6 lg:flex-row">
				<FilterSidebar brands={brands} {...filterState} />
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
						<FavoritesEmptyState />
					)}
					<InfiniteScrollSentinel
						hasNextPage={hasNextPage}
						isFetching={isFetching}
						isFetchingNextPage={isFetchingNextPage}
						fetchNextPage={fetchNextPage}
					/>
				</div>
			</div>

			{products.length > 0 && (
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							"@context": "https://schema.org",
							"@type": "ItemList",
							numberOfItems: totalProducts,
							itemListOrder: "https://schema.org/ItemListUnordered",
							itemListElement: mappedProducts.slice(0, 10).map((product, i) => ({
								"@type": "ListItem",
								position: i + 1,
								item: {
									"@type": "Product",
									name: product.name,
									url: `${getSiteUrl()}/producto/${product.slug}`,
									...(product.primaryImage ? { image: product.primaryImage.url } : {}),
									...(product.brand
										? {
												brand: { "@type": "Brand", name: product.brand.name },
											}
										: {}),
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
						}).replace(/<\//g, "<\\/"),
					}}
				/>
			)}
		</div>
	);
}

function FavoritesEmptyState() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>No tienes favoritos aún</EmptyTitle>
				<EmptyDescription>
					Guarda productos que te interesen para encontrarlos fácilmente después
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Link to="/buscar" search={{ q: "" }} className={buttonVariants({ variant: "default" })}>
					Explorar productos
				</Link>
			</EmptyContent>
		</Empty>
	);
}
