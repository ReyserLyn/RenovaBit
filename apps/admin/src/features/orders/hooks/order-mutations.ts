import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import type {
	UpdateOrderAttachmentsValues,
	UpdateOrderStatusValues,
} from "../service/orders.service";
import { type BatchActionStatus, ordersService } from "../service/orders.service";
import { orderKeys } from "./order-queries";

// ── Mutations ──────────────────────────────────────────

export function useUpdateOrderStatus() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateOrderStatusValues }) =>
			ordersService.updateStatus(id, data),
		onSuccess: (_data, { id }) => {
			queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
			queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) });
			toast.success("Estado del pedido actualizado correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useUpdateOrderAttachments() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateOrderAttachmentsValues }) =>
			ordersService.updateAttachments(id, data),
		onSuccess: (_data, { id }) => {
			queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
			queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) });
			toast.success("Adjuntos actualizados correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useBatchOrderStatus() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ ids, action }: { ids: string[]; action: BatchActionStatus }) =>
			ordersService.batchUpdate(ids, action),
		onSuccess: (result, { action }) => {
			queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
			queryClient.invalidateQueries({ queryKey: orderKeys.details() });

			const actionLabel: Record<string, string> = {
				confirmed: "confirmados",
				cancelled: "cancelados",
				refunded: "reembolsados",
			};

			if (result.succeeded.length > 0) {
				toast.success(
					`${result.succeeded.length} ${result.succeeded.length === 1 ? "pedido" : "pedidos"} ${actionLabel[action]} correctamente`,
				);
			}
			if (result.failed.length > 0) {
				toast.warning(
					`${result.failed.length} ${result.failed.length === 1 ? "pedido no se pudo procesar" : "pedidos no se pudieron procesar"}`,
				);
			}
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}
