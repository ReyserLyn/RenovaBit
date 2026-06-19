import { Elysia } from "elysia";
import { AuthModule } from "@/modules/auth";
import { ErrorResponse, FavoritesModel } from "./model";
import { FavoritesService } from "./service";

// ═══════════════════════════════════════════════════
//  Prefijo: /api/v1/favorites
// ═══════════════════════════════════════════════════

export const favoritesRoute = new Elysia({ prefix: "/favorites" })
	.use(AuthModule)
	// ── List Favorites ──────────────────────────
	.get(
		"/",
		async ({ query, user }) => {
			const userId = user.id;
			const favorite = await FavoritesService.getOrCreate(userId);

			return FavoritesService.getItems(favorite.id, {
				offset: query.offset,
				limit: query.limit,
				sortBy: query.sortBy,
				brands: query.brands,
				minPrice: query.minPrice,
				maxPrice: query.maxPrice,
			});
		},
		{
			isAuth: true,
			query: FavoritesModel.favoritesListQuery,
			response: { 200: FavoritesModel.favoriteListResponse, 400: ErrorResponse },
			detail: { summary: "Listar favoritos con filtros", tags: ["Favorites"] },
		},
	)

	// ── Add Product ─────────────────────────────
	.post(
		"/items",
		async ({ body, user }) => {
			const userId = user.id;
			const favorite = await FavoritesService.getOrCreate(userId);
			return FavoritesService.addItem(favorite.id, body);
		},
		{
			isAuth: true,
			body: FavoritesModel.addItemBody,
			response: {
				200: FavoritesModel.favoriteResponse,
				400: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Añadir producto a favoritos", tags: ["Favorites"] },
		},
	)

	// ── Check Favorite Status ──────────────────
	.get(
		"/items/:productId/status",
		async ({ params: { productId }, user }) => {
			const userId = user.id;
			return FavoritesService.checkFavorite(userId, productId);
		},
		{
			isAuth: true,
			params: FavoritesModel.productIdParams,
			response: { 200: FavoritesModel.favoriteStatusResponse, 400: ErrorResponse },
			detail: { summary: "Verificar si un producto está en favoritos", tags: ["Favorites"] },
		},
	)

	// ── Remove Product ──────────────────────────
	.delete(
		"/items/:productId",
		async ({ params: { productId }, user }) => {
			const userId = user.id;
			const favorite = await FavoritesService.getOrCreate(userId);
			return FavoritesService.removeItem(favorite.id, productId);
		},
		{
			isAuth: true,
			params: FavoritesModel.productIdParams,
			response: { 200: FavoritesModel.favoriteResponse, 404: ErrorResponse },
			detail: { summary: "Eliminar producto de favoritos", tags: ["Favorites"] },
		},
	);
