import { Elysia, t } from "elysia";
import { notFound } from "@/utils/api-helpers";
import { getUserId } from "@/utils/auth/helpers";
import { ErrorResponse, ProductModel } from "./model";
import { ProductService } from "./service";

// ═══════════════════════════════════════════════════
//  ADMIN — requiere isAdmin macro
//  Prefijo: /api/v1/admin/products
// ═══════════════════════════════════════════════════

export const adminProductsRoute = new Elysia({ prefix: "/products" })
	// ── List ─────────
	.get(
		"/",
		async ({ query }) => {
			return ProductService.list({
				brandId: query.brandId,
				categoryId: query.categoryId,
				isFeatured: query.isFeatured,
				search: query.search,
			});
		},
		{
			isAdmin: true,
			query: ProductModel.listQuery,
			response: {
				200: ProductModel.adminProductListResponse,
				401: ErrorResponse,
				403: ErrorResponse,
			},
			detail: { summary: "Listar todos los productos (admin)", tags: ["Products"] },
		},
	)

	// ── Get by ID ─────────────────────────────────
	.get(
		"/:id",
		async ({ params: { id } }) => {
			const product = await ProductService.getById(id);
			if (!product) throw notFound("Producto no encontrado");
			return product;
		},
		{
			isAdmin: true,
			params: ProductModel.idParams,
			response: {
				200: ProductModel.adminProductResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Obtener producto por ID (admin)", tags: ["Products"] },
		},
	)

	// ── Get by slug ───────────────────────
	.get(
		"/slug/:slug",
		async ({ params: { slug } }) => {
			const product = await ProductService.getBySlug(slug);
			if (!product) throw notFound("Producto no encontrado");
			return product;
		},
		{
			isAdmin: true,
			params: ProductModel.slugParams,
			response: {
				200: ProductModel.adminProductResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Obtener producto por slug (admin)", tags: ["Products"] },
		},
	)

	// ── Create ────────────────────────────────────
	.post(
		"/",
		async ({ body, request }) => {
			return ProductService.create(body, await getUserId(request));
		},
		{
			isAdmin: true,
			body: ProductModel.createBody,
			response: {
				201: ProductModel.adminProductResponse,
				400: ErrorResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				409: ErrorResponse,
			},
			detail: { summary: "Crear producto", tags: ["Products"] },
		},
	)

	// ── Update ────────────────────────────────────
	.patch(
		"/:id",
		async ({ params: { id }, body, request }) => {
			return ProductService.update(id, body, await getUserId(request));
		},
		{
			isAdmin: true,
			params: ProductModel.idParams,
			body: ProductModel.updateBody,
			response: {
				200: ProductModel.adminProductResponse,
				400: ErrorResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
				409: ErrorResponse,
			},
			detail: { summary: "Actualizar producto", tags: ["Products"] },
		},
	)

	// ── Delete ────────────────────────────────────
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

	// ── Bulk Delete ───────────────────────────────
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
	)

	// ── Changes history ───────────────────────────
	.get(
		"/:id/changes",
		async ({ params: { id } }) => {
			const changes = await ProductService.getChanges(id);
			return {
				changes: changes.map((c) => ({
					...c,
					reportStartedAt: c.reportStartedAt?.toISOString() ?? null,
					createdAt: c.createdAt.toISOString(),
				})),
				total: changes.length,
			};
		},
		{
			isAdmin: true,
			params: ProductModel.idParams,
			response: {
				200: t.Object({
					changes: t.Array(t.Any()),
					total: t.Integer({ minimum: 0 }),
				}),
				401: ErrorResponse,
				403: ErrorResponse,
			},
			detail: { summary: "Historial de cambios del producto", tags: ["Products"] },
		},
	);
