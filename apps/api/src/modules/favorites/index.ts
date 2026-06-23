import { Elysia } from "elysia";
import { AuthModule } from "@/modules/auth";
import { getUserRole } from "@/utils/auth/helpers";
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
		async ({ query, request, user }) => {
			const userId = user.id;
			const role = await getUserRole(request);
			const favorite = await FavoritesService.getOrCreate(userId);

			return FavoritesService.getItems(favorite.id, role, {
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

	// ── Check Favorite Status (batched) ──────
	// One DB roundtrip for N productIds. Used by product listings to avoid
	// one network call per card.
	.get(
		"/status",
		async ({ query, user }) => {
			const userId = user.id;
			const statuses = await FavoritesService.getStatusesForProducts(userId, query.productIds);
			return { statuses };
		},
		{
			isAuth: true,
			query: FavoritesModel.favoriteStatusBatchQuery,
			response: { 200: FavoritesModel.favoriteStatusBatchResponse, 400: ErrorResponse },
			detail: {
				summary: "Verificar favoritos para varios productos (batch)",
				tags: ["Favorites"],
			},
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
