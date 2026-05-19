import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia } from "elysia";
import { auth } from "@/utils/auth/auth";
import { BrandModel } from "./model";
import { BrandService } from "./service";

/**
 * Obtiene la sesión actual sin lanzar error si no hay sesión.
 * Útil para rutas públicas que necesitan saber si el usuario es admin.
 */
async function resolveOptionalSession(request: Request) {
	try {
		return await auth.api.getSession({ headers: request.headers });
	} catch {
		return null;
	}
}

export const brandsRoute = new Elysia({ prefix: "/brands" })
	// ── List ──────────────────────────────────────────
	// Público. Admin ve todo por defecto, el resto solo marcas activas.
	.get(
		"/",
		async ({ request }) => {
			const session = await resolveOptionalSession(request);
			const isAdmin = session?.user?.role === "admin";
			return BrandService.list(isAdmin ? undefined : { isActive: true });
		},
		{
			detail: { summary: "Listar marcas", tags: ["Brands"] },
		},
	)

	// ── Get by slug ───────────────────────────────────
	// Público. Oculta marcas inactivas a no-admins.
	.get(
		"/:slug",
		async ({ params: { slug }, request }) => {
			const brand = await BrandService.getBySlug(slug);
			if (!brand) {
				throw createApiError({
					code: BackendErrorCodes.NOT_FOUND_ERROR,
					message: "Marca no encontrada",
					logLevel: "info",
					doNotLog: true,
				});
			}

			// Si la marca está inactiva y no es admin, devolvemos 404
			if (!brand.isActive) {
				const session = await resolveOptionalSession(request);
				if (session?.user?.role !== "admin") {
					throw createApiError({
						code: BackendErrorCodes.NOT_FOUND_ERROR,
						message: "Marca no encontrada",
						logLevel: "info",
						doNotLog: true,
					});
				}
			}

			return brand;
		},
		{
			params: BrandModel.params,
			detail: { summary: "Obtener marca por slug", tags: ["Brands"] },
		},
	)

	// ── Create ────────────────────────────────────────
	.post("/", ({ body }) => BrandService.create(body), {
		isAdmin: true,
		body: BrandModel.createBody,
		detail: { summary: "Crear marca", tags: ["Brands"] },
	})

	// ── Update ────────────────────────────────────────
	.patch("/:slug", ({ params: { slug }, body }) => BrandService.update(slug, body), {
		isAdmin: true,
		params: BrandModel.params,
		body: BrandModel.updateBody,
		detail: { summary: "Actualizar marca", tags: ["Brands"] },
	})

	// ── Delete ────────────────────────────────────────
	.delete(
		"/:slug",
		async ({ params: { slug }, set }) => {
			await BrandService.delete(slug);
			set.status = 204;
		},
		{
			isAdmin: true,
			params: BrandModel.params,
			detail: { summary: "Eliminar marca", tags: ["Brands"] },
		},
	)

	// ── Bulk Delete ────────────────────────────────────
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
			detail: { summary: "Eliminar marcas en lote", tags: ["Brands"] },
		},
	);
