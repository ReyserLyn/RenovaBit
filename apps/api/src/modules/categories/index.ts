import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia, t } from "elysia";
import { auth } from "@/utils/auth/auth";
import { CategoryModel, ErrorResponse } from "./model";
import { CategoryService } from "./service";

// ── Helpers ────────────────────────────────────────

async function resolveOptionalSession(request: Request) {
	try {
		return await auth.api.getSession({ headers: request.headers });
	} catch {
		return null;
	}
}

// ── Routes ─────────────────────────────────────────

export const categoriesRoute = new Elysia({ prefix: "/categories" })
	// ═════════════════════════════════════════════════
	//  PUBLIC
	// ═════════════════════════════════════════════════

	// ── List ────────────────────────────────────────
	.get(
		"/",
		async ({ request, query }) => {
			const session = await resolveOptionalSession(request);
			const isAdmin = session?.user?.role === "admin";

			return CategoryService.list(
				{
					includeInactive: isAdmin ? query.includeInactive : false,
					isFeatured: query.isFeatured,
					parentId: query.parentId,
					isVisibleInNav: isAdmin ? query.isVisibleInNav : undefined,
				},
				isAdmin,
			);
		},
		{
			query: CategoryModel.listQuery,
			response: {
				200: CategoryModel.categoryListResponse,
			},
			detail: { summary: "Listar categorías", tags: ["Categories"] },
		},
	)

	// ── Tree ────────────────────────────────────────
	.get(
		"/tree",
		async ({ request, query }) => {
			const session = await resolveOptionalSession(request);
			const isAdmin = session?.user?.role === "admin";
			const includeInactive = isAdmin ? (query.includeInactive ?? false) : false;

			return CategoryService.getTree(includeInactive);
		},
		{
			query: CategoryModel.treeQuery,
			response: {
				200: CategoryModel.categoryTreeResponse,
			},
			detail: { summary: "Árbol jerárquico de categorías", tags: ["Categories"] },
		},
	)

	// ── Get by slug ─────────────────────────────────
	.get(
		"/slug/:slug",
		async ({ params: { slug }, request, query }) => {
			const session = await resolveOptionalSession(request);
			const isAdmin = session?.user?.role === "admin";
			const includeInactive = isAdmin ? (query.includeInactive ?? false) : false;

			const category = await CategoryService.getBySlug(slug, includeInactive);
			if (!category) {
				throw createApiError({
					code: BackendErrorCodes.NOT_FOUND_ERROR,
					message: "Categoría no encontrada",
					logLevel: "info",
					doNotLog: true,
				});
			}
			return category;
		},
		{
			params: CategoryModel.slugParams,
			query: CategoryModel.breadcrumbQuery,
			response: {
				200: CategoryModel.categoryResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Obtener categoría por slug", tags: ["Categories"] },
		},
	)

	// ── Get by id ───────────────────────────────────
	.get(
		"/:id",
		async ({ params: { id }, request, query }) => {
			const session = await resolveOptionalSession(request);
			const isAdmin = session?.user?.role === "admin";
			const includeInactive = isAdmin ? (query.includeInactive ?? false) : false;

			const category = await CategoryService.getById(id, includeInactive);
			if (!category) {
				throw createApiError({
					code: BackendErrorCodes.NOT_FOUND_ERROR,
					message: "Categoría no encontrada",
					logLevel: "info",
					doNotLog: true,
				});
			}
			return category;
		},
		{
			params: CategoryModel.idParams,
			query: CategoryModel.breadcrumbQuery,
			response: {
				200: CategoryModel.categoryResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Obtener categoría por ID", tags: ["Categories"] },
		},
	)

	// ── Breadcrumb ──────────────────────────────────
	.get(
		"/breadcrumb/:slug",
		async ({ params: { slug }, request, query }) => {
			const session = await resolveOptionalSession(request);
			const isAdmin = session?.user?.role === "admin";
			const includeInactive = isAdmin ? (query.includeInactive ?? false) : false;

			return CategoryService.getBreadcrumb(slug, includeInactive);
		},
		{
			params: CategoryModel.slugParams,
			query: CategoryModel.breadcrumbQuery,
			response: {
				200: CategoryModel.breadcrumbResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Breadcrumb de categoría", tags: ["Categories"] },
		},
	)

	// ═════════════════════════════════════════════════
	//  ADMIN
	// ═════════════════════════════════════════════════

	// ── Create ──────────────────────────────────────
	.post(
		"/",
		async ({ body, request }) => {
			const session = await resolveOptionalSession(request);
			return CategoryService.create(body, session?.user?.id ?? "");
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

	// ── Update ──────────────────────────────────────
	.patch(
		"/:id",
		async ({ params: { id }, body, request }) => {
			const session = await resolveOptionalSession(request);
			return CategoryService.update(id, body, session?.user?.id ?? "");
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

	// ── Delete ──────────────────────────────────────
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

	// ── Bulk Delete ─────────────────────────────────
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
