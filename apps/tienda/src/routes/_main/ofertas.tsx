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
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useFavoriteStatusMap } from "@/features/favorites/hooks/queries";
import { OfferSection } from "@/features/offers/components/offer-section";
import { type GetOffersInput, getOffersWithProductsServerFn } from "@/features/offers/hooks/server";
import type { OffersListResponse } from "@/features/offers/types";
import { FilterSidebar } from "@/shared/components/filters/filter-sidebar";
import { getSiteUrl } from "@/shared/lib/env";
import { type CatalogSearch, normalizeCatalogSearch } from "@/shared/lib/filters/search";
import { useOffersFilterState } from "@/shared/lib/hooks/use-filter-state";
import { breadcrumbJsonLd, offerListJsonLd, seo } from "@/shared/lib/seo";

function buildLoaderInput(s: CatalogSearch): GetOffersInput {
	const input: GetOffersInput = {};
	if (s.marcas) input.brandSlugs = s.marcas;
	if (s.precio_min) input.minPrice = s.precio_min;
	if (s.precio_max) input.maxPrice = s.precio_max;
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

	head: ({ loaderData }) => {
		const offersUrl = `${getSiteUrl()}/ofertas`;
		const seoTags = seo({
			title: "Ofertas · Renovabit",
			description:
				"Encuentra las mejores ofertas en repuestos, accesorios y equipos para tu negocio. Descuentos exclusivos en Renovabit.",
			url: offersUrl,
		});
		const offers = loaderData?.initialData?.offers ?? [];
		return {
			meta: [
				...seoTags.meta,
				{ property: "og:locale", content: "es_PE" },
				{ property: "og:url", content: offersUrl },
			],
			links: [{ rel: "canonical", href: offersUrl }, ...seoTags.links],
			scripts: [
				breadcrumbJsonLd([{ name: "Home", url: getSiteUrl() }, { name: "Ofertas" }]),
				offerListJsonLd(
					offers.map((o) => ({
						name: o.name,
						url: `${offersUrl}#offer-${o.slug}`,
						price: o.discountValue,
						validThrough: o.endsAt instanceof Date ? o.endsAt.toISOString() : String(o.endsAt),
					})),
				),
			],
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
	const router = useRouter();

	const filterState = useOffersFilterState();

	const [response, setResponse] = useState<OffersListResponse>(initialData);
	const [loadingOfferId, setLoadingOfferId] = useState<string | null>(null);

	// Sync local state with loader data when filters change and the loader re-runs.
	// Without this, the page shows stale offers after a filter change.
	useEffect(() => {
		setResponse(initialData);
	}, [initialData]);

	// Strip the URL hash only when the anchored offer isn't in the currently
	// visible list. Otherwise the hash stays as a shareable deep link.
	useEffect(() => {
		const hash = router.state.location.hash;
		if (!hash) return;
		const anchoredId = hash.slice(1);
		const stillVisible = response.offers.some((o) => `offer-${o.slug}` === anchoredId);
		if (stillVisible) return;
		router.navigate({
			to: router.state.location.pathname,
			search: (prev) => prev,
			hash: "",
			replace: true,
		});
	}, [response.offers, router]);

	const offers = response.offers;
	const brands = response.filters.brands;

	// Batched favorite status: one query for the union of all visible
	// product ids across all offers, instead of N per-card queries.
	const allProductIds = offers.flatMap((o) => o.products.items.map((p) => p.id));
	const favoriteStatuses = useFavoriteStatusMap(allProductIds);

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
			if (filterState.minPrice) input.minPrice = filterState.minPrice;
			if (filterState.maxPrice) input.maxPrice = filterState.maxPrice;
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
						offers.map((offer) => (
							<OfferSection
								key={offer.id}
								offer={offer}
								filteredProducts={offer.products}
								isLoadingMore={loadingOfferId === offer.id}
								onLoadMore={() => handleLoadMore(offer.id)}
								favoriteStatuses={favoriteStatuses}
							/>
						))
					)}
				</main>
			</div>
		</div>
	);
}
