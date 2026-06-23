import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiClientError, api, unwrapResponse } from "@/shared/lib/api";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import type { FavoriteListResponse, FavoriteStatusBatchResponse } from "./queries";
import { type FavoriteSnapshot, favoritesKeys } from "./queries";

function invalidateFavoritesQueries(queryClient: ReturnType<typeof useQueryClient>) {
	queryClient.invalidateQueries({ queryKey: favoritesKeys.all });
}

/** Key of a single-product status cache entry. */
function statusKeyForProduct(productId: string) {
	return [...favoritesKeys.all, "statuses", [productId]];
}

/** Key of a status-batch cache entry (the listing form). */
const STATUSES_KEY_ROOT = [...favoritesKeys.all, "statuses"] as const;

// ── Optimistic helpers ──────────────────────────────────────

function setFavoriteStatus(
	queryClient: ReturnType<typeof useQueryClient>,
	productId: string,
	value: boolean,
) {
	queryClient.setQueriesData<FavoriteStatusBatchResponse>({ queryKey: STATUSES_KEY_ROOT }, (old) =>
		old ? { statuses: { ...old.statuses, [productId]: value } } : old,
	);
}

function buildOptimisticItem(snapshot: FavoriteSnapshot) {
	return {
		id: `optimistic-${snapshot.productId}`,
		productId: snapshot.productId,
		productName: snapshot.productName,
		productSlug: snapshot.productSlug,
		productSku: snapshot.productSku,
		basePrice: snapshot.price,
		offerPrice: null,
		discountPercent: null,
		isFeatured: false,
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
			const [firstPage, ...rest] = old.pages;
			if (!firstPage) return old;
			return {
				...old,
				pages: [
					{ ...firstPage, data: [item, ...firstPage.data], total: firstPage.total + 1 },
					...rest,
				],
			};
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
			setFavoriteStatus(queryClient, productId, true);
			prependToInfiniteCaches(queryClient, buildOptimisticItem(snapshot));
		},
		onSuccess: () => {
			invalidateFavoritesQueries(queryClient);
		},
		onError: (error, { productId }) => {
			queryClient.invalidateQueries({ queryKey: statusKeyForProduct(productId) });
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
			setFavoriteStatus(queryClient, productId, false);
		},
		onSuccess: () => {
			invalidateFavoritesQueries(queryClient);
		},
		onError: (error, productId) => {
			queryClient.invalidateQueries({ queryKey: statusKeyForProduct(productId) });
			toast.error(resolveErrorMessage(error));
		},
	});
}
