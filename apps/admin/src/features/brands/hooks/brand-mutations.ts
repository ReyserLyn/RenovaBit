import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiClientError } from "@/shared/lib/api/api-errors";
import type { Brand, BulkDeleteValues, CreateBrandValues, UpdateBrandValues } from "../model";
import { brandsService } from "../service/brands.service";
import { brandKeys } from "./brand-queries";

// ── Helpers ────────────────────────────────────────────

function resolveErrorMessage(error: unknown): string {
	if (error instanceof ApiClientError) return error.message;
	if (error instanceof Error) return error.message;
	return "Error inesperado";
}

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
		mutationFn: ({ slug, data }: { slug: string; data: UpdateBrandValues }) =>
			brandsService.update(slug, data),
		onSuccess: (_data, { slug }) => {
			queryClient.invalidateQueries({ queryKey: brandKeys.lists() });
			queryClient.invalidateQueries({ queryKey: brandKeys.detail(slug) });
			toast.success("Marca actualizada correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useDeleteBrand() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (slug: string) => brandsService.delete(slug),
		onSuccess: (_data, slug) => {
			queryClient.removeQueries({ queryKey: brandKeys.detail(slug) });
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
