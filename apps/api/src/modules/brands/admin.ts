import { Elysia, t } from "elysia";
import { notFound } from "@/utils/api-helpers";
import { getUserId } from "@/utils/auth/helpers";
import { BrandModel, ErrorResponse } from "./model";
import { BrandService } from "./service";

// ═══════════════════════════════════════════════════
//  ADMIN — requiere isAdmin macro
//  Prefijo: /api/v1/admin/brands
// ═══════════════════════════════════════════════════

export const adminBrandsRoute = new Elysia({ prefix: "/brands" })
	// ── List ──────────────────────────────────────
	.get(
		"/",
		async () => {
			return BrandService.listAdmin();
		},
		{
			isAdmin: true,
			response: {
				200: BrandModel.brandListResponse,
				401: ErrorResponse,
				403: ErrorResponse,
			},
			detail: { summary: "Listar todas las marcas (admin)", tags: ["Brands"] },
		},
	)

	// ── Get by ID ─────────────────────────────────
	.get(
		"/:id",
		async ({ params: { id } }) => {
			const brand = await BrandService.getByIdAdmin(id);
			if (!brand) throw notFound("Marca no encontrada");
			return brand;
		},
		{
			isAdmin: true,
			params: BrandModel.idParams,
			response: {
				200: BrandModel.brandResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Obtener marca por ID (admin)", tags: ["Brands"] },
		},
	)

	// ── Get by slug ───────────────────────────────
	.get(
		"/slug/:slug",
		async ({ params: { slug } }) => {
			const brand = await BrandService.getBySlugAdmin(slug);
			if (!brand) throw notFound("Marca no encontrada");
			return brand;
		},
		{
			isAdmin: true,
			params: BrandModel.slugParams,
			response: {
				200: BrandModel.brandResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Obtener marca por slug (admin)", tags: ["Brands"] },
		},
	)

	// ── Create ────────────────────────────────────
	.post(
		"/",
		async ({ body, request }) => {
			return BrandService.create(body, await getUserId(request));
		},
		{
			isAdmin: true,
			body: BrandModel.createBody,
			response: {
				201: BrandModel.brandResponse,
				400: ErrorResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				409: ErrorResponse,
			},
			detail: { summary: "Crear marca", tags: ["Brands"] },
		},
	)

	// ── Update ────────────────────────────────────
	.patch(
		"/:id",
		async ({ params: { id }, body, request }) => {
			return BrandService.update(id, body, await getUserId(request));
		},
		{
			isAdmin: true,
			params: BrandModel.idParams,
			body: BrandModel.updateBody,
			response: {
				200: BrandModel.brandResponse,
				400: ErrorResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
				409: ErrorResponse,
			},
			detail: { summary: "Actualizar marca", tags: ["Brands"] },
		},
	)

	// ── Delete ────────────────────────────────────
	.delete(
		"/:id",
		async ({ params: { id }, set }) => {
			await BrandService.delete(id);
			set.status = 204;
		},
		{
			isAdmin: true,
			params: BrandModel.idParams,
			response: {
				204: t.Undefined(),
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Eliminar marca", tags: ["Brands"] },
		},
	)

	// ── Bulk Delete ───────────────────────────────
	.post(
		"/bulk",
		async ({ body, set }) => {
			const result = await BrandService.deleteMany(body.ids);
			if (result.notFoundIds.length > 0) set.status = 207;
			return result;
		},
		{
			isAdmin: true,
			body: BrandModel.bulkDeleteBody,
			response: {
				200: BrandModel.bulkDeleteResponse,
				207: BrandModel.bulkDeleteResponse,
				400: ErrorResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Eliminar marcas en lote", tags: ["Brands"] },
		},
	);
