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

/**
 * Guarda solo las notas del admin (mismo endpoint PATCH /orders/:id, sin
 * cambio de estado). Se separa para no mentir con "Estado actualizado".
 */
export function useUpdateOrderNotes() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateOrderStatusValues }) =>
			ordersService.updateStatus(id, data),
		onSuccess: (_data, { id }) => {
			queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
			queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) });
			toast.success("Notas del pedido guardadas correctamente");
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
				// La API devuelve { id, reason }: los motivos se agrupan para que el
				// operador sepa POR QUÉ fallaron, no solo cuántos fallaron.
				const reasonCounts = new Map<string, number>();
				for (const failed of result.failed) {
					const reason = failed.reason || "Error desconocido";
					reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
				}
				const entries = [...reasonCounts.entries()].slice(0, 3);
				const lines = entries.map(([reason, count]) =>
					count > 1 ? `${count}× ${reason}` : reason,
				);
				const remainingReasons = reasonCounts.size - entries.length;
				if (remainingReasons > 0) {
					lines.push(`…y ${remainingReasons} motivo${remainingReasons === 1 ? "" : "s"} más`);
				}
				toast.warning(
					`${result.failed.length} ${result.failed.length === 1 ? "pedido no se pudo procesar" : "pedidos no se pudieron procesar"}`,
					{ description: lines.join("\n"), duration: 10_000 },
				);
			}
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}
