import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import { offersService } from "../service/offers.service";
import { offerKeys } from "./use-offers";

// ── Mutations ──────────────────────────────────────────

export function useCreateOffer() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: Parameters<typeof offersService.create>[0]) => offersService.create(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
			toast.success("Oferta creada correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useUpdateOffer() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: Parameters<typeof offersService.update>[1] }) =>
			offersService.update(id, data),
		onSuccess: (_data, { id }) => {
			queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
			queryClient.invalidateQueries({ queryKey: offerKeys.detail(id) });
			toast.success("Oferta actualizada correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useToggleOfferActive() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
			offersService.update(id, { isActive }),
		onSuccess: (_data, { id, isActive }) => {
			queryClient.invalidateQueries({ queryKey: offerKeys.detail(id) });
			queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
			toast.success(
				isActive ? "Oferta activada correctamente" : "Oferta desactivada correctamente",
			);
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useDeleteOffer() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => offersService.delete(id),
		onSuccess: (_data, id) => {
			queryClient.removeQueries({ queryKey: offerKeys.detail(id) });
			queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
			toast.success("Oferta desactivada correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}
