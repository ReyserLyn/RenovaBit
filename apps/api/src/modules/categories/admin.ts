import { Elysia, t } from "elysia";
import { AuthModule } from "@/modules/auth";
import { notFound } from "@/utils/api-helpers";
import { CategoryModel, ErrorResponse } from "./model";
import { CategoryService } from "./service";

// ═══════════════════════════════════════════════════
//  ADMIN — requiere isAdmin macro
//  Prefijo: /api/v1/admin/categories
// ═══════════════════════════════════════════════════

export const adminCategoriesRoute = new Elysia({ prefix: "/categories" })
	.use(AuthModule)
	// ── List ──────────────────────────────────────
	.get(
		"/",
		async ({ query }) => {
			return CategoryService.listAdmin({
				includeInactive: query.includeInactive,
				isFeatured: query.isFeatured,
				parentId: query.parentId,
				isVisibleInNav: query.isVisibleInNav,
			});
		},
		{
			isAdmin: true,
			query: CategoryModel.listQuery,
			response: {
				200: CategoryModel.categoryListResponse,
				401: ErrorResponse,
				403: ErrorResponse,
			},
			detail: { summary: "Listar categorías (admin)", tags: ["Categories"] },
		},
	)

	// ── Tree ──────────────────────────────────────
	.get(
		"/tree",
		async ({ query }) => {
			return CategoryService.getTreeAdmin(query.includeInactive ?? false);
		},
		{
			isAdmin: true,
			query: CategoryModel.treeQuery,
			response: {
				200: CategoryModel.categoryTreeResponse,
				401: ErrorResponse,
				403: ErrorResponse,
			},
			detail: { summary: "Árbol de categorías (admin)", tags: ["Categories"] },
		},
	)

	// ── Get by slug ───────────────────────────────
	.get(
		"/slug/:slug",
		async ({ params: { slug } }) => {
			const category = await CategoryService.getBySlugAdmin(slug);
			if (!category) throw notFound("Categoría no encontrada");
			return category;
		},
		{
			isAdmin: true,
			params: CategoryModel.slugParams,
			response: {
				200: CategoryModel.categoryResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Obtener categoría por slug (admin)", tags: ["Categories"] },
		},
	)

	// ── Get by id ─────────────────────────────────
	.get(
		"/:id",
		async ({ params: { id } }) => {
			const category = await CategoryService.getByIdAdmin(id);
			if (!category) throw notFound("Categoría no encontrada");
			return category;
		},
		{
			isAdmin: true,
			params: CategoryModel.idParams,
			response: {
				200: CategoryModel.categoryResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Obtener categoría por ID (admin)", tags: ["Categories"] },
		},
	)

	// ── Create ────────────────────────────────────
	.post(
		"/",
		async ({ body, user }) => {
			return CategoryService.create(body, user.id);
		},
		{
			isAdmin: true,
			body: CategoryModel.createBody,
			response: {
				201: CategoryModel.categoryResponse,
				400: ErrorResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				409: ErrorResponse,
			},
			detail: { summary: "Crear categoría", tags: ["Categories"] },
		},
	)

	// ── Update ────────────────────────────────────
	.patch(
		"/:id",
		async ({ params: { id }, body, user }) => {
			return CategoryService.update(id, body, user.id);
		},
		{
			isAdmin: true,
			params: CategoryModel.idParams,
			body: CategoryModel.updateBody,
			response: {
				200: CategoryModel.categoryResponse,
				400: ErrorResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
				409: ErrorResponse,
			},
			detail: { summary: "Actualizar categoría", tags: ["Categories"] },
		},
	)

	// ── Delete ────────────────────────────────────
	.delete(
		"/:id",
		async ({ params: { id }, set }) => {
			await CategoryService.delete(id);
			set.status = 204;
		},
		{
			isAdmin: true,
			params: CategoryModel.idParams,
			response: {
				204: t.Undefined(),
				400: ErrorResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Eliminar categoría", tags: ["Categories"] },
		},
	)

	// ── Bulk Delete ───────────────────────────────
	.post(
		"/bulk",
		async ({ body, set }) => {
			const result = await CategoryService.deleteMany(body.ids);
			if (result.notFoundIds.length > 0) set.status = 207;
			return result;
		},
		{
			isAdmin: true,
			body: CategoryModel.bulkDeleteBody,
			response: {
				200: CategoryModel.bulkDeleteResponse,
				207: CategoryModel.bulkDeleteResponse,
				400: ErrorResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Eliminar categorías en lote", tags: ["Categories"] },
		},
	);
