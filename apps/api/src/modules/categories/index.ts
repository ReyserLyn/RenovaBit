import { Elysia } from "elysia";
import { notFound } from "@/utils/api-helpers";
import { CategoryModel, ErrorResponse } from "./model";
import { CategoryService } from "./service";

// ═══════════════════════════════════════════════════
//  PÚBLICO — sin auth
//  Prefijo: /api/v1/categories
// ═══════════════════════════════════════════════════

export const categoriesRoute = new Elysia({ prefix: "/categories" })
	// ── Tree ──────────────────────────────────────
	.get(
		"/",
		async () => {
			return CategoryService.getTreePublic();
		},
		{
			response: { 200: CategoryModel.publicCategoryTreeResponse },
			detail: {
				summary: "Árbol de categorías",
				description: "Árbol jerárquico de categorías activas con conteo de productos.",
				tags: ["Categories"],
			},
		},
	)

	// ── Detail by slug ────────────────────────────
	.get(
		"/:slug",
		async ({ params: { slug } }) => {
			const category = await CategoryService.getBySlugPublic(slug);
			if (!category) throw notFound("Categoría no encontrada");
			return category;
		},
		{
			params: CategoryModel.slugParams,
			response: {
				200: CategoryModel.publicCategoryDetail,
				404: ErrorResponse,
			},
			detail: {
				summary: "Detalle de categoría por slug",
				description: "Devuelve categoría, breadcrumb y conteo de productos.",
				tags: ["Categories"],
			},
		},
	);
