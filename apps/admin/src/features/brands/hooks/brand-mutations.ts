import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import type { Brand, BulkDeleteValues, CreateBrandValues, UpdateBrandValues } from "../model";
import { brandsService } from "../service/brands.service";
import { brandKeys } from "./brand-queries";

// ── Mutations ──────────────────────────────────────────

export function useCreateBrand() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: CreateBrandValues) => brandsService.create(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: brandKeys.lists() });
			toast.success("Marca creada correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useUpdateBrand() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateBrandValues }) =>
			brandsService.update(id, data),
		onSuccess: (_data, { id }) => {
			queryClient.invalidateQueries({ queryKey: brandKeys.lists() });
			queryClient.invalidateQueries({ queryKey: brandKeys.detail(id) });
			toast.success("Marca actualizada correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useToggleBrandField() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateBrandValues }) =>
			brandsService.update(id, data),
		onMutate: async ({ id, data }) => {
			await queryClient.cancelQueries({ queryKey: brandKeys.lists() });
			await queryClient.cancelQueries({ queryKey: brandKeys.detail(id) });
			const previousBrands = queryClient.getQueryData<Brand[]>(brandKeys.lists());
			const previousBrand = queryClient.getQueryData<Brand>(brandKeys.detail(id));

			queryClient.setQueryData(brandKeys.lists(), (old: Brand[] | undefined) => {
				if (!old) return old;
				return old.map((b) => (b.id === id ? { ...b, ...data } : b));
			});

			queryClient.setQueryData(brandKeys.detail(id), (old: Brand | undefined) => {
				if (!old) return old;
				return { ...old, ...data };
			});

			return { previousBrands, previousBrand };
		},
		onError: (err, { id }, context) => {
			if (context?.previousBrands) {
				queryClient.setQueryData(brandKeys.lists(), context.previousBrands);
			}
			if (context?.previousBrand) {
				queryClient.setQueryData(brandKeys.detail(id), context.previousBrand);
			}
			toast.error(resolveErrorMessage(err));
		},
		onSettled: (_data, _error, { id }) => {
			queryClient.invalidateQueries({ queryKey: brandKeys.lists() });
			queryClient.invalidateQueries({ queryKey: brandKeys.detail(id) });
		},
	});
}

export function useDeleteBrand() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => brandsService.delete(id),
		onSuccess: (_data, id) => {
			queryClient.removeQueries({ queryKey: brandKeys.detail(id) });
			queryClient.invalidateQueries({ queryKey: brandKeys.lists() });
			toast.success("Marca eliminada correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useBulkDeleteBrands() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: BulkDeleteValues) => brandsService.deleteMany(data),
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: brandKeys.lists() });
			queryClient.invalidateQueries({ queryKey: brandKeys.details() });

			if (result.notFoundIds.length > 0) {
				toast.warning(
					`Se eliminaron ${result.deletedCount} marcas. ${result.notFoundIds.length} no ${result.notFoundIds.length === 1 ? "fue" : "fueron"} encontrada${result.notFoundIds.length === 1 ? "" : "s"}.`,
				);
			} else {
				toast.success(
					`${result.deletedCount} ${result.deletedCount === 1 ? "marca eliminada" : "marcas eliminadas"} correctamente.`,
				);
			}
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}
