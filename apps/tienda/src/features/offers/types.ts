import type { api } from "@/shared/lib/api/api-client";

type _OffersGetData = NonNullable<Awaited<ReturnType<typeof api.api.v1.offers.get>>["data"]>;

export type OffersListResponse = _OffersGetData;
export type OfferWithProducts = _OffersGetData["offers"][number];
export type OfferProductPage = OfferWithProducts["products"];
export type OfferProduct = OfferProductPage["items"][number];
export type OfferBrandItem = _OffersGetData["filters"]["brands"][number];
