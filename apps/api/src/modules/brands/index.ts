import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia, t } from "elysia";
import { auth } from "@/utils/auth/auth";
import { BrandModel, ErrorResponse } from "./model";
import { BrandService } from "./service";

// ── Helpers ────────────────────────────────────────

async function resolveOptionalSession(request: Request) {
	try {
		return await auth.api.getSession({ headers: request.headers });
	} catch {
		return null;
	}
}

// ── Routes ─────────────────────────────────────────

export const brandsRoute = new Elysia({ prefix: "/brands" })
	// ── List ────────────────────────────────────────
	.get(
		"/",
		async ({ request }) => {
			const session = await resolveOptionalSession(request);
			const isAdmin = session?.user?.role === "admin";
			return BrandService.list(isAdmin ? undefined : { isActive: true });
		},
		{
			response: {
				200: BrandModel.brandListResponse,
			},
			detail: { summary: "Listar marcas", tags: ["Brands"] },
		},
	)

	// ── Get by slug ─────────────────────────────────
	.get(
		"/:slug",
		async ({ params: { slug }, request }) => {
			const session = await resolveOptionalSession(request);
			const isAdmin = session?.user?.role === "admin";

			const brand = await BrandService.getBySlug(slug);
			if (!brand) {
				throw createApiError({
					code: BackendErrorCodes.NOT_FOUND_ERROR,
					message: "Marca no encontrada",
					logLevel: "info",
					doNotLog: true,
				});
			}

			// Si está inactiva y no es admin, devolvemos 404 (no 403)
			if (!brand.isActive && !isAdmin) {
				throw createApiError({
					code: BackendErrorCodes.NOT_FOUND_ERROR,
					message: "Marca no encontrada",
					logLevel: "info",
					doNotLog: true,
				});
			}

			return brand;
		},
		{
			params: BrandModel.params,
			response: {
				200: BrandModel.brandResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Obtener marca por slug", tags: ["Brands"] },
		},
	)

	// ── Create ──────────────────────────────────────
	.post(
		"/",
		async ({ body, request }) => {
			const session = await resolveOptionalSession(request);
			return BrandService.create(body, session?.user?.id ?? "");
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

	// ── Get by id (admin) ───────────────────────────
	.get(
		"/id/:id",
		async ({ params: { id } }) => {
			const brand = await BrandService.getById(id);
			if (!brand) {
				throw createApiError({
					code: BackendErrorCodes.NOT_FOUND_ERROR,
					message: "Marca no encontrada",
					logLevel: "info",
					doNotLog: true,
				});
			}
			return brand;
		},
		{
			isAdmin: true,
			params: BrandModel.idParams,
			response: {
				200: BrandModel.brandResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Obtener marca por ID (admin)", tags: ["Brands"] },
		},
	)

	// ── Update ──────────────────────────────────────
	.patch(
		"/id/:id",
		async ({ params: { id }, body, request }) => {
			const session = await resolveOptionalSession(request);
			return BrandService.update(id, body, session?.user?.id ?? "");
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

	// ── Delete ──────────────────────────────────────
	.delete(
		"/id/:id",
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

	// ── Bulk Delete ─────────────────────────────────
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
