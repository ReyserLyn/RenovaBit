import { Elysia } from "elysia";
import { BrandModel } from "./model";
import { BrandService } from "./service";

export const brandsRoute = new Elysia({ prefix: "/brands" })
	// ── List ──────────────────────────────────────
	.get("/", () => BrandService.list(), {
		detail: { summary: "Listar marcas", tags: ["Brands"] },
	})

	// ── Get by slug ───────────────────────────────
	.get(
		"/:slug",
		async ({ params: { slug }, set }) => {
			const item = await BrandService.getBySlug(slug);
			if (!item) {
				set.status = 404;
				return { message: "Brand not found" };
			}
			return item;
		},
		{ params: BrandModel.params, detail: { summary: "Obtener marca por slug", tags: ["Brands"] } },
	)

	// ── Create ────────────────────────────────────
	.post("/", ({ body }) => BrandService.create(body), {
		body: BrandModel.createBody,
		detail: { summary: "Crear marca", tags: ["Brands"] },
	})

	// ── Update ────────────────────────────────────
	.patch(
		"/:slug",
		async ({ params: { slug }, body, set }) => {
			const item = await BrandService.update(slug, body);
			if (!item) {
				set.status = 404;
				return { message: "Brand not found" };
			}
			return item;
		},
		{
			params: BrandModel.params,
			body: BrandModel.updateBody,
			detail: { summary: "Actualizar marca", tags: ["Brands"] },
		},
	)

	// ── Delete ────────────────────────────────────
	.delete(
		"/:slug",
		async ({ params: { slug }, set }) => {
			const deleted = await BrandService.delete(slug);
			if (!deleted) {
				set.status = 404;
				return { message: "Brand not found" };
			}
			set.status = 204;
		},
		{ params: BrandModel.params, detail: { summary: "Eliminar marca", tags: ["Brands"] } },
	)

	// ── Bulk Delete ───────────────────────────────
	.post(
		"/bulk-delete",
		async ({ body, set }) => {
			const result = await BrandService.deleteMany(body.ids);
			if (result.deletedCount === 0) {
				set.status = 404;
				return result;
			}
			if (result.notFoundIds.length > 0) set.status = 207;
			return result;
		},
		{
			body: BrandModel.bulkDelete,
			detail: { summary: "Eliminar marcas en lote", tags: ["Brands"] },
		},
	);
