import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiClientError } from "@/shared/lib/api/api-errors";
import type { BulkDeleteValues, CreateCategoryValues, UpdateCategoryValues } from "../model";
import { categoriesService } from "../service/categories.service";
import { categoryKeys } from "./categories-queries";

// ── Helpers ────────────────────────────────────────────

function resolveErrorMessage(error: unknown): string {
	if (error instanceof ApiClientError) return error.message;
	if (error instanceof Error) return error.message;
	return "Error inesperado";
}

// ── Mutations ──────────────────────────────────────────

export function useCreateCategory() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: CreateCategoryValues) => categoriesService.create(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
			queryClient.invalidateQueries({ queryKey: categoryKeys.trees() });
			toast.success("Categoría creada correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useUpdateCategory() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateCategoryValues }) =>
			categoriesService.update(id, data),
		onSuccess: (_data, { id }) => {
			queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
			queryClient.invalidateQueries({ queryKey: categoryKeys.trees() });
			queryClient.invalidateQueries({ queryKey: categoryKeys.detail(id) });
			toast.success("Categoría actualizada correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useDeleteCategory() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => categoriesService.delete(id),
		onSuccess: (_data, id) => {
			queryClient.removeQueries({ queryKey: categoryKeys.detail(id) });
			queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
			queryClient.invalidateQueries({ queryKey: categoryKeys.trees() });
			toast.success("Categoría eliminada correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useBulkDeleteCategories() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: BulkDeleteValues) => categoriesService.deleteMany(data),
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
			queryClient.invalidateQueries({ queryKey: categoryKeys.trees() });
			queryClient.invalidateQueries({ queryKey: categoryKeys.details() });

			if (result.notFoundIds.length > 0) {
				toast.warning(
					`Se eliminaron ${result.deletedCount} categorías. ${result.notFoundIds.length} no ${result.notFoundIds.length === 1 ? "fue" : "fueron"} encontrada${result.notFoundIds.length === 1 ? "" : "s"}.`,
				);
			} else {
				toast.success(
					`${result.deletedCount} ${result.deletedCount === 1 ? "categoría eliminada" : "categorías eliminadas"} correctamente.`,
				);
			}
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useReorderCategories() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (orders: Array<{ id: string; sortOrder: number }>) =>
			categoriesService.reorder({ orders }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
			queryClient.invalidateQueries({ queryKey: categoryKeys.trees() });
			toast.success("Categorías reordenadas correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}
