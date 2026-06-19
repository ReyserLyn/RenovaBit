/**
 * Offers public routes — active offers listing and detail.
 * Mounted at `/api/v1/offers` via `apps/api/src/modules/index.ts`.
 */
import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia, t } from "elysia";
import { OfferModel } from "./model";
import { OfferService } from "./service";

export const publicOffersRoute = new Elysia({ prefix: "/offers" })
	// ── List active offers ──────────────────────
	.get("/", async () => OfferService.getActive(), {
		response: {
			200: OfferModel.offerActiveListResponse,
		},
		detail: {
			summary: "Listar ofertas activas",
			description: "Devuelve las ofertas activas con conteo de productos",
			tags: ["Offers"],
		},
	})
	// ── Get active offer by slug ────────────────
	.get(
		"/:slug",
		async ({ params: { slug } }) => {
			const offer = await OfferService.getActiveBySlug(slug);

			if (!offer) {
				throw createApiError({
					code: BackendErrorCodes.NOT_FOUND_ERROR,
					message: "Oferta no encontrada",
					logLevel: "info",
					doNotLog: true,
				});
			}

			// Include applicable items based on offer type. The detail schema
			// is a union of {…base, products?|brands?|categories?} — return
			// the matching branch so the response type stays precise.
			if (offer.type === "product") {
				const products = await OfferService.getProducts(offer.id);
				return { ...offer, products };
			}

			if (offer.type === "brand") {
				const brands = await OfferService.getBrands(offer.id);
				return { ...offer, brands };
			}

			const categories = await OfferService.getCategories(offer.id);
			return { ...offer, categories };
		},
		{
			params: OfferModel.slugParams,
			response: {
				200: t.Union([
					OfferModel.offerWithProductsResponse,
					OfferModel.offerWithBrandsResponse,
					OfferModel.offerWithCategoriesResponse,
				]),
				404: OfferModel.errorResponse,
			},
			detail: {
				summary: "Obtener oferta por slug",
				description: "Devuelve una oferta activa con sus productos asociados",
				tags: ["Offers"],
			},
		},
	);
