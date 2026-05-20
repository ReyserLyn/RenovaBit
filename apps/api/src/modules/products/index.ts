import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia, t } from "elysia";
import { auth } from "@/utils/auth/auth";
import { ErrorResponse, ProductModel } from "./model";
import { ProductService } from "./service";

// ── Helpers ────────────────────────────────────────

async function resolveOptionalSession(request: Request) {
	try {
		return await auth.api.getSession({ headers: request.headers });
	} catch {
		return null;
	}
}

// ── Routes ─────────────────────────────────────────

export const productsRoute = new Elysia({ prefix: "/products" })
	// ═════════════════════════════════════════════════
	//  PUBLIC
	// ═════════════════════════════════════════════════

	// ── List ────────────────────────────────────────
	.get(
		"/",
		async ({ request, query }) => {
			const session = await resolveOptionalSession(request);
			const isAdmin = session?.user?.role === "admin";

			return ProductService.list(
				{
					brandId: query.brandId,
					categoryId: query.categoryId,
					isFeatured: query.isFeatured,
					includeInactive: isAdmin ? query.includeInactive : false,
				},
				isAdmin,
			);
		},
		{
			query: ProductModel.listQuery,
			response: {
				200: ProductModel.productListResponse,
			},
			detail: { summary: "Listar productos", tags: ["Products"] },
		},
	)

	// ── Get by slug ─────────────────────────────────
	.get(
		"/slug/:slug",
		async ({ params: { slug }, request }) => {
			const session = await resolveOptionalSession(request);
			const isAdmin = session?.user?.role === "admin";

			const product = await ProductService.getBySlug(slug, isAdmin);
			if (!product) {
				throw createApiError({
					code: BackendErrorCodes.NOT_FOUND_ERROR,
					message: "Producto no encontrado",
					logLevel: "info",
					doNotLog: true,
				});
			}
			return product;
		},
		{
			params: ProductModel.slugParams,
			response: {
				200: ProductModel.productResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Obtener producto por slug", tags: ["Products"] },
		},
	)

	// ── Get by id ───────────────────────────────────
	.get(
		"/:id",
		async ({ params: { id }, request }) => {
			const session = await resolveOptionalSession(request);
			const isAdmin = session?.user?.role === "admin";

			const product = await ProductService.getById(id, isAdmin);
			if (!product) {
				throw createApiError({
					code: BackendErrorCodes.NOT_FOUND_ERROR,
					message: "Producto no encontrado",
					logLevel: "info",
					doNotLog: true,
				});
			}
			return product;
		},
		{
			params: ProductModel.idParams,
			response: {
				200: ProductModel.productResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Obtener producto por ID", tags: ["Products"] },
		},
	)

	// ═════════════════════════════════════════════════
	//  ADMIN
	// ═════════════════════════════════════════════════

	// ── Create ──────────────────────────────────────
	.post("/", ({ body }) => ProductService.create(body), {
		isAdmin: true,
		body: ProductModel.createBody,
		response: {
			201: ProductModel.productResponse,
			400: ErrorResponse,
			401: ErrorResponse,
			403: ErrorResponse,
			409: ErrorResponse,
		},
		detail: { summary: "Crear producto", tags: ["Products"] },
	})

	// ── Update ──────────────────────────────────────
	.patch("/:id", ({ params: { id }, body }) => ProductService.update(id, body), {
		isAdmin: true,
		params: ProductModel.idParams,
		body: ProductModel.updateBody,
		response: {
			200: ProductModel.productResponse,
			400: ErrorResponse,
			401: ErrorResponse,
			403: ErrorResponse,
			404: ErrorResponse,
			409: ErrorResponse,
		},
		detail: { summary: "Actualizar producto", tags: ["Products"] },
	})

	// ── Delete ──────────────────────────────────────
	.delete(
		"/:id",
		async ({ params: { id }, set }) => {
			await ProductService.delete(id);
			set.status = 204;
		},
		{
			isAdmin: true,
			params: ProductModel.idParams,
			response: {
				204: t.Undefined(),
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Eliminar producto", tags: ["Products"] },
		},
	)

	// ── Bulk Delete ─────────────────────────────────
	.post(
		"/bulk",
		async ({ body, set }) => {
			const result = await ProductService.deleteMany(body.ids);
			if (result.notFoundIds.length > 0) set.status = 207;
			return result;
		},
		{
			isAdmin: true,
			body: ProductModel.bulkDeleteBody,
			response: {
				200: ProductModel.bulkDeleteResponse,
				207: ProductModel.bulkDeleteResponse,
				400: ErrorResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Eliminar productos en lote", tags: ["Products"] },
		},
	);
