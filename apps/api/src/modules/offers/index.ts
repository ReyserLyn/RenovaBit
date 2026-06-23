/**
 * Offers public routes — consolidated listing with products.
 * Mounted at `/api/v1/offers` via `apps/api/src/modules/index.ts`.
 */
import { Elysia } from "elysia";
import { getUserRole } from "@/utils/auth/helpers";
import { OfferModel } from "./model";
import { OfferService } from "./service";

export const publicOffersRoute = new Elysia({ prefix: "/offers" })
	// ── Consolidated offer list (with products) ──
	.get(
		"/",
		async ({ query, request }) => {
			const role = await getUserRole(request);
			const result = await OfferService.getOffersWithProducts(role, {
				offset: query.offset,
				limit: query.limit,
				isFeatured: query.isFeatured,
				brandSlugs: query.brands,
				offerId: query.offerId,
				productsOffset: query.productsOffset,
				productsLimit: query.productsLimit,
				minPrice: query.minPrice,
				maxPrice: query.maxPrice,
			});
			return result;
		},
		{
			query: OfferModel.offerListQuery,
			response: {
				200: OfferModel.offerListEnrichedResponse,
			},
			detail: {
				summary: "Listar ofertas con productos (consolidado)",
				description:
					"Devuelve todas las ofertas activas con sus productos enriquecidos (precios por rol). " +
					"Usar ?offerId=X&productsOffset=Y&productsLimit=Z para paginar productos de una oferta específica. " +
					"Filtrable por isFeatured y brands (comma-separated brand slugs).",
				tags: ["Offers"],
			},
		},
	);
