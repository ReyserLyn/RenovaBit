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

	// ── Featured (home carousel) ──────────────────
	.get(
		"/featured",
		async () => {
			const all = await CategoryService.getFeaturedPublic();
			// Cap server-side so the home carousel stays bounded.
			return all.slice(0, 20);
		},
		{
			response: { 200: CategoryModel.publicFeaturedCategoryResponse },
			detail: {
				summary: "Categorías featured para el home",
				description:
					"Lista plana de categorías activas marcadas como featured, ordenadas por productCount DESC. Cap de 20.",
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
