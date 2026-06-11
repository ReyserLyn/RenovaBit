import { Elysia } from "elysia";
import { notFound } from "@/utils/api-helpers";
import { ErrorResponse, ProductModel } from "./model";
import { ProductService } from "./service";

// ═══════════════════════════════════════════════════
//  PÚBLICO — sin auth
//  Prefijo: /api/v1/products
// ═══════════════════════════════════════════════════

export const productsRoute = new Elysia({ prefix: "/products" })
	// ── List ──────────────────────────────────────
	.get(
		"/",
		async ({ query }) => {
			return ProductService.listPublic({
				brandId: query.brandId,
				brandSlugs: query.brands,
				categoryId: query.categoryId,
				categorySlug: query.categorySlug,
				isFeatured: query.isFeatured,
				search: query.search,
				sortBy: query.sortBy,
				minPrice: query.minPrice,
				maxPrice: query.maxPrice,
				offset: query.offset,
				limit: query.limit,
				excludeSlug: query.excludeSlug,
			});
		},
		{
			query: ProductModel.listQuery,
			response: {
				200: ProductModel.publicProductListResponse,
			},
			detail: {
				summary: "Listar productos",
				description:
					"Productos activos y revisados. Filtrable por marca, categoría, precio, orden y búsqueda.",
				tags: ["Products"],
			},
		},
	)

	// ── Detail by slug ────────────────────────────
	.get(
		"/:slug",
		async ({ params: { slug } }) => {
			const product = await ProductService.getBySlugPublic(slug);
			if (!product) throw notFound("Producto no encontrado");
			return product;
		},
		{
			params: ProductModel.slugParams,
			response: {
				200: ProductModel.publicProductDetail,
				404: ErrorResponse,
			},
			detail: {
				summary: "Detalle de producto por slug",
				description:
					"Devuelve toda la información pública: imágenes, especificaciones, marca y categoría.",
				tags: ["Products"],
			},
		},
	);
