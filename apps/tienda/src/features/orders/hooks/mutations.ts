import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cartKeys } from "@/features/cart/hooks/queries";
import { api, unwrapResponse } from "@/shared/lib/api";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import { orderKeys } from "./queries";

type CreateOrderInput = Parameters<typeof api.api.v1.orders.post>[0];

export function useCreateOrder() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: CreateOrderInput) => unwrapResponse(api.api.v1.orders.post(data)),
		onSuccess: (order) => {
			queryClient.invalidateQueries({ queryKey: cartKeys.all });
			queryClient.invalidateQueries({ queryKey: orderKeys.all });
			toast.success(`Pedido ${order.orderNumber} creado con éxito`, { duration: 5000 });
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}
