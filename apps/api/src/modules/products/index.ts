import { Elysia } from "elysia";
import { notFound } from "@/utils/api-helpers";
import { getUserRole } from "@/utils/auth/helpers";
import { ErrorResponse, ProductModel } from "./model";
import { ProductService } from "./service";

// ═══════════════════════════════════════════════════
//  PÚBLICO — sin auth (precio por rol)
//  Prefijo: /api/v1/products
// ═══════════════════════════════════════════════════

export const productsRoute = new Elysia({ prefix: "/products" })
	// ── List ──────────────────────────────────────
	.get(
		"/",
		async ({ query, request }) => {
			const role = await getUserRole(request);
			return ProductService.listPublic({
				brandId: query.brandId,
				brandSlugs: query.brands,
				categoryId: query.categoryId,
				categorySlug: query.categorySlug,
				categorySlugs: query.categories,
				isFeatured: query.isFeatured,
				search: query.search,
				sortBy: query.sortBy,
				minPrice: query.minPrice,
				maxPrice: query.maxPrice,
				offset: query.offset,
				limit: query.limit,
				excludeSlug: query.excludeSlug,
				role,
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

	// ── Search (FTS) ──────────────────────────────
	.get(
		"/search",
		async ({ query, request, set }) => {
			set.headers["Cache-Control"] = "no-store";
			const role = await getUserRole(request);
			return ProductService.search(
				query.q,
				query.limit,
				query.offset,
				query.brands,
				query.minPrice,
				query.maxPrice,
				query.sortBy,
				role,
			);
		},
		{
			query: ProductModel.searchQuery,
			response: {
				200: ProductModel.searchResponse,
			},
			detail: {
				summary: "Buscar productos",
				description:
					"Búsqueda full-text en español sobre nombres de productos. También busca por prefijo de SKU. Ordenado por relevancia, disponibilidad y nombre.",
				tags: ["Products"],
			},
		},
	)

	// ── Detail by slug ────────────────────────────
	.get(
		"/:slug",
		async ({ params: { slug }, request }) => {
			const role = await getUserRole(request);
			const product = await ProductService.getBySlugPublic(slug, role);
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
