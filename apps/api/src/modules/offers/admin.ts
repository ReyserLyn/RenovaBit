import { Elysia, t } from "elysia";
import { AuthModule } from "@/modules/auth";
import { notFound } from "@/utils/api-helpers";
import { OfferModel } from "./model";
import { OfferService } from "./service";

export const adminOffersRoute = new Elysia({ prefix: "/offers" })
	.use(AuthModule)
	// ── List ──────────────────────────────────────
	.get("/", async ({ query }) => OfferService.list(query), {
		isAdmin: true,
		query: OfferModel.listQuery,
		response: {
			200: OfferModel.offerListResponse,
			401: OfferModel.errorResponse,
			403: OfferModel.errorResponse,
		},
		detail: { summary: "Listar ofertas (admin)", tags: ["Offers"] },
	})

	// ── Create ────────────────────────────────────
	.post(
		"/",
		async ({ body, user, set }) => {
			const offer = await OfferService.create(body, user.id);
			set.status = 201;
			return offer;
		},
		{
			isAdmin: true,
			body: OfferModel.createBody,
			response: {
				201: OfferModel.offerResponse,
				400: OfferModel.errorResponse,
				401: OfferModel.errorResponse,
				403: OfferModel.errorResponse,
				409: OfferModel.errorResponse,
			},
			detail: { summary: "Crear oferta", tags: ["Offers"] },
		},
	)

	// ── Get by ID ─────────────────────────────────
	.get(
		"/:id",
		async ({ params: { id } }) => {
			const offer = await OfferService.getById(id);
			if (!offer) throw notFound("Oferta no encontrada");
			return offer;
		},
		{
			isAdmin: true,
			params: OfferModel.idParams,
			response: {
				200: OfferModel.offerResponse,
				401: OfferModel.errorResponse,
				403: OfferModel.errorResponse,
				404: OfferModel.errorResponse,
			},
			detail: { summary: "Obtener oferta por ID", tags: ["Offers"] },
		},
	)

	// ── Update ────────────────────────────────────
	.put("/:id", async ({ params: { id }, body, user }) => OfferService.update(id, body, user.id), {
		isAdmin: true,
		params: OfferModel.idParams,
		body: OfferModel.updateBody,
		response: {
			200: OfferModel.offerResponse,
			400: OfferModel.errorResponse,
			401: OfferModel.errorResponse,
			403: OfferModel.errorResponse,
			404: OfferModel.errorResponse,
			409: OfferModel.errorResponse,
		},
		detail: { summary: "Actualizar oferta", tags: ["Offers"] },
	})

	// ── Delete (soft) ─────────────────────────────
	.delete(
		"/:id",
		async ({ params: { id }, set }) => {
			await OfferService.delete(id);
			set.status = 204;
		},
		{
			isAdmin: true,
			params: OfferModel.idParams,
			response: {
				204: t.Undefined(),
				401: OfferModel.errorResponse,
				403: OfferModel.errorResponse,
				404: OfferModel.errorResponse,
			},
			detail: { summary: "Desactivar oferta (soft delete)", tags: ["Offers"] },
		},
	)

	// ── Assign products ───────────────────────────
	.post(
		"/:id/products",
		async ({ params: { id }, body }) =>
			OfferService.assignProducts(id, body.productIds, body.overrides),
		{
			isAdmin: true,
			params: OfferModel.idParams,
			body: OfferModel.productAssignBody,
			response: {
				200: OfferModel.assignResponse,
				400: OfferModel.errorResponse,
				401: OfferModel.errorResponse,
				403: OfferModel.errorResponse,
				404: OfferModel.errorResponse,
			},
			detail: { summary: "Asignar productos a oferta", tags: ["Offers"] },
		},
	)

	// ── Get products for offer ────────────────────
	.get("/:id/products", async ({ params: { id } }) => OfferService.getProductsWithDetails(id), {
		isAdmin: true,
		params: OfferModel.idParams,
		response: {
			200: OfferModel.offerProductDetailResponse,
			401: OfferModel.errorResponse,
			403: OfferModel.errorResponse,
			404: OfferModel.errorResponse,
		},
		detail: { summary: "Productos asignados a oferta", tags: ["Offers"] },
	});
