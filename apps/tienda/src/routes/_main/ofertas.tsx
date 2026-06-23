import { PackageIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@renovabit/ui/components/ui/empty";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OfferSection } from "@/features/offers/components/offer-section";
import { type GetOffersInput, getOffersWithProductsServerFn } from "@/features/offers/hooks/server";
import type {
	OfferProductPage,
	OffersListResponse,
	OfferWithProducts,
} from "@/features/offers/types";
import { FilterSidebar } from "@/shared/components/filters/filter-sidebar";
import { authSessionQueryOptions } from "@/shared/lib/auth/auth-session";
import { getSiteUrl } from "@/shared/lib/env";
import { type CatalogSearch, normalizeCatalogSearch } from "@/shared/lib/filters/search";
import { useOffersFilterState } from "@/shared/lib/hooks/use-filter-state";
import { breadcrumbJsonLd, seo } from "@/shared/lib/seo";

function buildLoaderInput(s: CatalogSearch): GetOffersInput {
	const input: GetOffersInput = {};
	if (s.marcas) input.brandSlugs = s.marcas;
	return input;
}

export const Route = createFileRoute("/_main/ofertas")({
	validateSearch: (s: Record<string, unknown>): CatalogSearch => normalizeCatalogSearch(s, true),

	loaderDeps: ({ search }) => ({
		marcas: search.marcas,
		precio_min: search.precio_min,
		precio_max: search.precio_max,
	}),

	loader: async ({ deps }) => {
		const input = buildLoaderInput(deps);
		const result = await getOffersWithProductsServerFn({ data: input });
		return {
			initialData: result ?? { offers: [], filters: { brands: [] } },
		};
	},

	head: () => {
		const offersUrl = `${getSiteUrl()}/ofertas`;
		const seoTags = seo({
			title: "Ofertas · Renovabit",
			description:
				"Encuentra las mejores ofertas en repuestos, accesorios y equipos para tu negocio. Descuentos exclusivos en Renovabit.",
			url: offersUrl,
		});
		return {
			meta: [
				...seoTags.meta,
				{ property: "og:locale", content: "es_PE" },
				{ property: "og:url", content: offersUrl },
			],
			links: [{ rel: "canonical", href: offersUrl }, ...seoTags.links],
			scripts: [breadcrumbJsonLd([{ name: "Home", url: getSiteUrl() }, { name: "Ofertas" }])],
		};
	},

	component: OfertasPage,

	errorComponent: ({ error }) => {
		console.error("[ofertas] Error:", error);
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
				<h1 className="text-2xl font-bold tracking-tight">Ofertas</h1>
				<p className="text-muted-foreground mt-2">
					Ocurrió un error al cargar las ofertas. Intenta de nuevo más tarde.
				</p>
			</div>
		);
	},
});

function OfertasPage() {
	const { initialData } = Route.useLoaderData();
	const { data: session } = useQuery(authSessionQueryOptions());
	const role = session?.user?.role ?? "customer";
	const router = useRouter();

	const filterState = useOffersFilterState();

	const [response, setResponse] = useState<OffersListResponse>(initialData);
	const [loadingOfferId, setLoadingOfferId] = useState<string | null>(null);

	// Sync local state with loader data when filters change and the loader re-runs.
	// Without this, the page shows stale offers after a filter change.
	useEffect(() => {
		setResponse(initialData);
	}, [initialData]);

	// Strip the URL hash when a brand filter is active: the offer in the hash
	// may not be in the filtered list, leaving a dead `#offer-xyz` fragment.
	// Goes through the router's navigate so the framework stays in sync.
	useEffect(() => {
		const hasBrandFilter = (filterState.selectedBrandSlugs?.length ?? 0) > 0;
		if (!hasBrandFilter) return;
		if (!router.state.location.hash) return;
		router.navigate({
			to: router.state.location.pathname,
			search: (prev) => prev,
			hash: "",
			replace: true,
		});
	}, [filterState.selectedBrandSlugs, router]);

	const offers = response.offers;
	const brands = response.filters.brands;

	// Index always reflects the currently visible offers (after API-side filtering).
	// The user navigates via the index, so the hash anchor stays valid.
	const indexItems = offers.map((offer) => ({
		id: `offer-${offer.slug}`,
		label: offer.name,
	}));

	async function handleLoadMore(offerId: string) {
		setLoadingOfferId(offerId);
		try {
			const input: GetOffersInput = { offerId };
			if (filterState.selectedBrandSlugs && filterState.selectedBrandSlugs.length > 0) {
				input.brandSlugs = filterState.selectedBrandSlugs.join(",");
			}
			const currentOffer = offers.find((o) => o.id === offerId);
			input.productsOffset = currentOffer?.products.items.length ?? 0;
			input.productsLimit = 20;

			const result = await getOffersWithProductsServerFn({ data: input });

			if (result) {
				setResponse((prev) => {
					const newOffers = prev.offers.map((o) => {
						if (o.id !== offerId) return o;
						const newOffer = result.offers.find((ro) => ro.id === offerId);
						if (!newOffer) return o;
						return {
							...o,
							products: {
								items: [...o.products.items, ...newOffer.products.items],
								nextOffset: newOffer.products.nextOffset,
								total: newOffer.products.total,
							},
						};
					});
					return { ...prev, offers: newOffers };
				});
			}
		} finally {
			setLoadingOfferId(null);
		}
	}

	const minPrice = filterState.minPrice ? Number(filterState.minPrice) : null;
	const maxPrice = filterState.maxPrice ? Number(filterState.maxPrice) : null;

	function filterProductsByPrice(offer: OfferWithProducts): OfferProductPage {
		if (!minPrice && !maxPrice) return offer.products;
		const filtered = offer.products.items.filter((p) => {
			const price = p.basePrice ? Number(p.basePrice) : null;
			if (price === null) return false;
			if (minPrice !== null && price < minPrice) return false;
			if (maxPrice !== null && price > maxPrice) return false;
			return true;
		});
		return { items: filtered, nextOffset: null, total: filtered.length };
	}

	const hasActiveFilters = filterState.hasActiveFilters;

	return (
		<div className="flex flex-1 flex-col gap-6 py-6">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">Ofertas</h1>
				<p className="text-muted-foreground max-w-2xl text-base">
					Las mejores ofertas para vos. Descuentos en productos, marcas y categorías.
				</p>
			</div>

			<div className="flex flex-col gap-6 lg:flex-row">
				<FilterSidebar brands={brands} indexItems={indexItems} {...filterState} />

				<main className="min-w-0 flex-1 space-y-10">
					{offers.length === 0 ? (
						<Empty>
							<EmptyMedia>
								<HugeiconsIcon icon={PackageIcon} size={32} strokeWidth={1} />
							</EmptyMedia>
							<EmptyHeader>
								<EmptyTitle>
									{hasActiveFilters
										? "No hay ofertas con esos filtros"
										: "No hay ofertas disponibles"}
								</EmptyTitle>
							</EmptyHeader>
							<EmptyContent>
								<EmptyDescription>
									{hasActiveFilters
										? "No hay ofertas activas que coincidan con los filtros seleccionados."
										: "No hay ofertas disponibles en este momento. Vuelve a consultar más tarde."}
								</EmptyDescription>
							</EmptyContent>
						</Empty>
					) : (
						offers.map((offer) => {
							const filteredProducts = filterProductsByPrice(offer);
							return (
								<OfferSection
									key={offer.id}
									offer={offer}
									filteredProducts={filteredProducts}
									role={role}
									isLoadingMore={loadingOfferId === offer.id}
									onLoadMore={() => handleLoadMore(offer.id)}
								/>
							);
						})
					)}
				</main>
			</div>
		</div>
	);
}
