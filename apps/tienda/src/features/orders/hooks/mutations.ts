import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cartKeys } from "@/features/cart/hooks/queries";
import { api, unwrapResponse } from "@/shared/lib/api";
import { isAuthError, resolveErrorMessage } from "@/shared/lib/api/error-utils";
import { authKeys } from "@/shared/lib/auth/auth-session";
import { orderKeys } from "./queries";

type CreateOrderInput = Parameters<typeof api.api.v1.orders.post>[0];

/**
 * 401/ACCESS_DENIED on an order mutation means the server no longer trusts the
 * caller's session (expired cookie, revoked session, or a cart the session no
 * longer owns). Show an actionable message instead of the raw API text and
 * refresh the session cache; the cart itself is deliberately untouched so the
 * user doesn't lose it.
 */
function showAuthAwareError(error: unknown, queryClient: ReturnType<typeof useQueryClient>): void {
	if (isAuthError(error)) {
		void queryClient.invalidateQueries({ queryKey: authKeys.all });
		toast.error("Tu sesión expiró", {
			description: "Inicia sesión nuevamente para continuar. Tu carrito se mantiene intacto.",
			action: {
				label: "Iniciar sesión",
				onClick: () => {
					window.location.href = "/iniciar-sesion";
				},
			},
			duration: 10_000,
		});
		return;
	}

	toast.error(resolveErrorMessage(error));
}

export function useCreateOrder() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: CreateOrderInput) => unwrapResponse(api.api.v1.orders.post(data)),
		onSuccess: (order) => {
			queryClient.invalidateQueries({ queryKey: cartKeys.all });
			queryClient.invalidateQueries({ queryKey: orderKeys.all });
			toast.success(`Pedido ${order.orderNumber} creado con éxito`, {
				duration: 5000,
			});
		},
		onError: (error) => {
			showAuthAwareError(error, queryClient);
		},
	});
}

export function useCancelOrder() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => unwrapResponse(api.api.v1.orders({ id }).cancel.post()),
		onSuccess: (order) => {
			queryClient.invalidateQueries({ queryKey: orderKeys.all });
			queryClient.setQueryData(orderKeys.detail(order.id), order);
			toast.success(`Pedido ${order.orderNumber} cancelado`);
		},
		onError: (error) => {
			showAuthAwareError(error, queryClient);
		},
	});
}
