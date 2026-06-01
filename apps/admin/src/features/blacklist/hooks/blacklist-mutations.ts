import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import type { AddBlacklistValues, BlacklistEntry, RemoveBlacklistValues } from "../model";
import { blacklistService } from "../service/blacklist.service";
import { blacklistKeys } from "./blacklist-queries";

// ── Mutations ──────────────────────────────────────────

export function useAddToBlacklist() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: AddBlacklistValues) => blacklistService.add(data),
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: blacklistKeys.all });
			if (result.productDeleted) {
				toast.success("ID añadido a la lista negra y producto eliminado");
			} else {
				toast.success("ID añadido a la lista negra");
			}
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useRemoveFromBlacklist() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: RemoveBlacklistValues) => blacklistService.remove(data),
		onMutate: async (data) => {
			await queryClient.cancelQueries({ queryKey: blacklistKeys.lists() });
			const previousEntries = queryClient.getQueryData<BlacklistEntry[]>(blacklistKeys.lists());

			// Optimistic: eliminar la entrada de la cache
			queryClient.setQueryData(blacklistKeys.lists(), (old: BlacklistEntry[] | undefined) => {
				if (!old) return old;
				return old.filter(
					(e) => !(e.externalId === data.externalId && e.source === (data.source ?? "rematazo")),
				);
			});

			return { previousEntries };
		},
		onSuccess: () => {
			toast.success("ID removido de la lista negra. Volverá a sincronizarse.");
		},
		onError: (err, _data, context) => {
			if (context?.previousEntries) {
				queryClient.setQueryData(blacklistKeys.lists(), context.previousEntries);
			}
			toast.error(resolveErrorMessage(err));
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: blacklistKeys.all });
		},
	});
}
