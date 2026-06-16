import { Elysia } from "elysia";
import { notFound } from "@/utils/api-helpers";
import { BrandModel, ErrorResponse } from "./model";
import { BrandService } from "./service";

// ═══════════════════════════════════════════════════
//  PÚBLICO — sin auth
//  Prefijo: /api/v1/brands
// ═══════════════════════════════════════════════════

export const brandsRoute = new Elysia({ prefix: "/brands" })
	// ── List ──────────────────────────────────────
	.get(
		"/",
		async ({ query }) => {
			return BrandService.listPublic(query.categorySlug, query.q);
		},
		{
			query: BrandModel.listQuery,
			response: { 200: BrandModel.publicBrandListResponse },
			detail: {
				summary: "Listar marcas",
				description: "Marcas activas con conteo de productos. Filtrable por categoría.",
				tags: ["Brands"],
			},
		},
	)

	// ── Detail by slug ────────────────────────────
	.get(
		"/:slug",
		async ({ params: { slug } }) => {
			const brand = await BrandService.getBySlugPublic(slug);
			if (!brand) throw notFound("Marca no encontrada");
			return brand;
		},
		{
			params: BrandModel.slugParams,
			response: {
				200: BrandModel.publicBrandDetail,
				404: ErrorResponse,
			},
			detail: {
				summary: "Detalle de marca por slug",
				description: "Devuelve información de la marca con conteo de productos.",
				tags: ["Brands"],
			},
		},
	);
