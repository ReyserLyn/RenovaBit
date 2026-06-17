import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiClientError, api, unwrapResponse } from "@/shared/lib/api";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import { useGuestTokenStore } from "@/shared/lib/stores/guest-token";
import type { CartResponse } from "./queries";
import { cartKeys } from "./queries";

// ── Helpers ──────────────────────────────────────────────────

function getGuestToken(): string | null {
	return useGuestTokenStore.getState().guestToken;
}

function syncGuestToken(guestToken: string | null | undefined) {
	if (guestToken) {
		useGuestTokenStore.getState().setGuestToken(guestToken);
	}
}

function toCartScopeKey(guestToken: string | null | undefined): string {
	return guestToken ?? "__session__";
}

function updateCartCache(queryClient: ReturnType<typeof useQueryClient>, cart: CartResponse) {
	const scopeKey = toCartScopeKey(cart.guestToken);
	queryClient.setQueryData([...cartKeys.detail(), scopeKey], cart);
	queryClient.setQueryData([...cartKeys.total(), scopeKey], {
		itemsCount: cart.itemsCount,
		subtotal: cart.subtotal,
	});
}

function invalidateCartQueries(queryClient: ReturnType<typeof useQueryClient>) {
	queryClient.invalidateQueries({ queryKey: cartKeys.all });
}

// ── Add Item ─────────────────────────────────────────────────

export function useAddToCart() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ productId, quantity }: { productId: string; quantity?: number }) =>
			unwrapResponse(
				api.api.v1.cart.items.post(
					{ productId, quantity: quantity ?? 1 },
					{ query: { guestToken: getGuestToken() ?? undefined } },
				),
			),
		onSuccess: (data) => {
			updateCartCache(queryClient, data);
			invalidateCartQueries(queryClient);
			syncGuestToken(data.guestToken);
			toast.success("Producto añadido al carrito", { duration: 2000 });
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

// ── Update Quantity ──────────────────────────────────────────

export function useUpdateCartItem() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
			unwrapResponse(
				api.api.v1.cart
					.items({ id: itemId })
					.patch({ quantity }, { query: { guestToken: getGuestToken() ?? undefined } }),
			),
		onSuccess: (data) => {
			updateCartCache(queryClient, data);
			invalidateCartQueries(queryClient);
			syncGuestToken(data.guestToken);
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

// ── Remove Item ──────────────────────────────────────────────

export function useRemoveCartItem() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (itemId: string) =>
			unwrapResponse(
				api.api.v1.cart.items({ id: itemId }).delete(undefined, {
					query: { guestToken: getGuestToken() ?? undefined },
				}),
			),
		onSuccess: (data) => {
			updateCartCache(queryClient, data);
			invalidateCartQueries(queryClient);
			syncGuestToken(data.guestToken);
			toast.success("Producto eliminado del carrito", { duration: 2000 });
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

// ── Clear Cart ───────────────────────────────────────────────

export function useClearCart() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () =>
			api.api.v1.cart.delete(undefined, {
				query: { guestToken: getGuestToken() ?? undefined },
			}),
		onSuccess: () => {
			const scopeKey = toCartScopeKey(useGuestTokenStore.getState().guestToken);
			queryClient.setQueryData([...cartKeys.detail(), scopeKey], {
				id: "",
				guestToken: null,
				items: [],
				itemsCount: 0,
				subtotal: "0",
				lastActivityAt: "",
			});
			queryClient.setQueryData([...cartKeys.total(), scopeKey], {
				itemsCount: 0,
				subtotal: "0.00",
			});
			invalidateCartQueries(queryClient);
			toast.success("Carrito vaciado");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

// ── Merge Guest Cart ─────────────────────────────────────────

export function useMergeCart() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (guestToken: string) => unwrapResponse(api.api.v1.cart.merge.post({ guestToken })),
		onSuccess: (data) => {
			updateCartCache(queryClient, data);
			useGuestTokenStore.getState().clearGuestToken();
			invalidateCartQueries(queryClient);
		},
		onError: (error) => {
			if (error instanceof ApiClientError && error.code === "NOT_FOUND_ERROR") {
				useGuestTokenStore.getState().clearGuestToken();
				invalidateCartQueries(queryClient);
				return;
			}
			toast.error(resolveErrorMessage(error));
		},
	});
}
