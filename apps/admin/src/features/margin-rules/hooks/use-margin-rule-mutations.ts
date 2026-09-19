import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { productKeys } from "@/features/products/hooks/products-queries";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import { marginRulesService } from "../service/margin-rules.service";
import { marginRuleKeys } from "./use-margin-rules";

/**
 * La API recalcula los precios guardados en segundo plano tras cada cambio de
 * reglas (fire-and-forget). La lista de productos necesita refetch y el
 * operador necesita saber que el valor puede tardar en reflejarse: sin esto,
 * la tabla muestra precios viejos durante su staleTime de 5 minutos.
 */
const PRICES_RECALCULATING_MESSAGE =
	" Los precios guardados se están recalculando en segundo plano.";

function invalidateProductLists(queryClient: QueryClient): void {
	queryClient.invalidateQueries({ queryKey: productKeys.lists() });
}

// ── Mutations ──────────────────────────────────────────

export function useCreateMarginRule() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: Parameters<typeof marginRulesService.create>[0]) =>
			marginRulesService.create(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: marginRuleKeys.lists() });
			invalidateProductLists(queryClient);
			toast.success(`Regla de margen creada correctamente.${PRICES_RECALCULATING_MESSAGE}`);
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useUpdateMarginRule() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: string;
			data: Parameters<typeof marginRulesService.update>[1];
		}) => marginRulesService.update(id, data),
		onSuccess: (_data, { id }) => {
			queryClient.invalidateQueries({ queryKey: marginRuleKeys.lists() });
			queryClient.invalidateQueries({ queryKey: marginRuleKeys.detail(id) });
			invalidateProductLists(queryClient);
			toast.success(`Regla de margen actualizada correctamente.${PRICES_RECALCULATING_MESSAGE}`);
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useDeleteMarginRule() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => marginRulesService.delete(id),
		onSuccess: (_data, id) => {
			queryClient.removeQueries({ queryKey: marginRuleKeys.detail(id) });
			queryClient.invalidateQueries({ queryKey: marginRuleKeys.lists() });
			invalidateProductLists(queryClient);
			toast.success(`Regla de margen eliminada correctamente.${PRICES_RECALCULATING_MESSAGE}`);
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}
