import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia, t } from "elysia";
import { auth } from "@/utils/auth/auth";
import { ErrorResponse, FavoritesModel } from "./model";
import { FavoritesService } from "./service";

async function requireAuth(request: Request): Promise<string> {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) {
		throw createApiError({
			code: BackendErrorCodes.INVALID_CREDENTIALS,
			message: "Inicia sesión para gestionar tus favoritos",
			logLevel: "info",
			doNotLog: true,
		});
	}
	return session.user.id;
}

// ═══════════════════════════════════════════════════
//  Prefijo: /api/v1/favorites
// ═══════════════════════════════════════════════════

export const favoritesRoute = new Elysia({ prefix: "/favorites" })
	// ── List Favorites ──────────────────────────
	.get(
		"/",
		async ({ query, request }) => {
			const userId = await requireAuth(request);
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
			query: FavoritesModel.favoritesListQuery,
			response: { 200: FavoritesModel.favoriteListResponse, 400: ErrorResponse },
			detail: { summary: "Listar favoritos con filtros", tags: ["Favorites"] },
		},
	)

	// ── Add Product ─────────────────────────────
	.post(
		"/items",
		async ({ body, request }) => {
			const userId = await requireAuth(request);
			const favorite = await FavoritesService.getOrCreate(userId);
			return FavoritesService.addItem(favorite.id, body);
		},
		{
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
		async ({ params: { productId }, request }) => {
			const userId = await requireAuth(request);
			return FavoritesService.checkFavorite(userId, productId);
		},
		{
			params: FavoritesModel.productIdParams,
			response: { 200: FavoritesModel.favoriteStatusResponse, 400: ErrorResponse },
			detail: { summary: "Verificar si un producto está en favoritos", tags: ["Favorites"] },
		},
	)

	// ── Remove Product ──────────────────────────
	.delete(
		"/items/:productId",
		async ({ params: { productId }, request }) => {
			const userId = await requireAuth(request);
			const favorite = await FavoritesService.getOrCreate(userId);
			return FavoritesService.removeItem(favorite.id, productId);
		},
		{
			params: FavoritesModel.productIdParams,
			response: { 200: FavoritesModel.favoriteResponse, 404: ErrorResponse },
			detail: { summary: "Eliminar producto de favoritos", tags: ["Favorites"] },
		},
	);
