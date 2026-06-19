import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import { marginRulesService } from "../service/margin-rules.service";
import { marginRuleKeys } from "./use-margin-rules";

// ── Mutations ──────────────────────────────────────────

export function useCreateMarginRule() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: Parameters<typeof marginRulesService.create>[0]) =>
			marginRulesService.create(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: marginRuleKeys.lists() });
			toast.success("Regla de margen creada correctamente");
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
			toast.success("Regla de margen actualizada correctamente");
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
			toast.success("Regla de margen eliminada correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}
