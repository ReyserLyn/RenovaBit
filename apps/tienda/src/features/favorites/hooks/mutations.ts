import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiClientError, api, unwrapResponse } from "@/shared/lib/api";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import type { FavoriteListResponse } from "./queries";
import { type FavoriteSnapshot, favoritesKeys } from "./queries";

function invalidateFavoritesQueries(queryClient: ReturnType<typeof useQueryClient>) {
	queryClient.invalidateQueries({ queryKey: favoritesKeys.all });
}

// ── Helpers ─────────────────────────────────────────────

function buildOptimisticItem(snapshot: FavoriteSnapshot) {
	return {
		id: `optimistic-${snapshot.productId}`,
		productId: snapshot.productId,
		productName: snapshot.productName,
		productSlug: snapshot.productSlug,
		productSku: snapshot.productSku,
		price: snapshot.price,
		stock: snapshot.stock,
		isInStock: snapshot.isInStock,
		primaryImage: snapshot.primaryImage,
		brand: snapshot.brand,
		category: snapshot.category,
		createdAt: new Date().toISOString(),
	};
}

function prependToInfiniteCaches(
	queryClient: ReturnType<typeof useQueryClient>,
	item: ReturnType<typeof buildOptimisticItem>,
) {
	queryClient.setQueriesData<{
		pages: FavoriteListResponse[];
		pageParams: number[];
	}>(
		{
			queryKey: favoritesKeys.all,
			predicate: (query) => query.queryKey[1] === "infinite",
		},
		(old) => {
			if (!old?.pages?.length) return old;
			const newPages = [...old.pages];
			const firstPage = newPages[0];
			if (!firstPage) return old;
			newPages[0] = {
				...firstPage,
				data: [item, ...firstPage.data],
				total: firstPage.total + 1,
			};
			return { ...old, pages: newPages };
		},
	);
}

// ── Add Favorite ────────────────────────────────────────────

export function useAddFavorite() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ productId }: { productId: string; snapshot: FavoriteSnapshot }) =>
			unwrapResponse(api.api.v1.favorites.items.post({ productId })),
		onMutate: ({ productId, snapshot }) => {
			// 1. Optimistic status query
			queryClient.setQueryData(favoritesKeys.detail(productId), {
				isFavorite: true,
			});
			// 2. Seed ALL infinite caches so navigation is instant
			prependToInfiniteCaches(queryClient, buildOptimisticItem(snapshot));
		},
		onSuccess: () => {
			invalidateFavoritesQueries(queryClient);
		},
		onError: (error, { productId }) => {
			queryClient.invalidateQueries({
				queryKey: favoritesKeys.detail(productId),
			});
			invalidateFavoritesQueries(queryClient);
			if (error instanceof ApiClientError && error.code === "NOT_FOUND_ERROR") {
				toast.error("Producto no encontrado");
				return;
			}
			toast.error(resolveErrorMessage(error));
		},
	});
}

// ── Remove Favorite ─────────────────────────────────────────

export function useRemoveFavorite() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (productId: string) =>
			unwrapResponse(api.api.v1.favorites.items({ productId }).delete()),
		onMutate: (productId) => {
			queryClient.setQueryData(favoritesKeys.detail(productId), {
				isFavorite: false,
			});
		},
		onSuccess: () => {
			invalidateFavoritesQueries(queryClient);
		},
		onError: (error, productId) => {
			queryClient.invalidateQueries({
				queryKey: favoritesKeys.detail(productId),
			});
			toast.error(resolveErrorMessage(error));
		},
	});
}
