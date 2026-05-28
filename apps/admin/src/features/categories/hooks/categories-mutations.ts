import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import type {
	BulkDeleteValues,
	Category,
	CreateCategoryValues,
	UpdateCategoryValues,
} from "../model";
import { categoriesService } from "../service/categories.service";
import { categoryKeys } from "./categories-queries";

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

export function useToggleCategoryField() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateCategoryValues }) =>
			categoriesService.update(id, data),
		onMutate: async ({ id, data }) => {
			await queryClient.cancelQueries({ queryKey: categoryKeys.lists() });
			await queryClient.cancelQueries({ queryKey: categoryKeys.trees() });
			await queryClient.cancelQueries({ queryKey: categoryKeys.detail(id) });
			const previousCategories = queryClient.getQueryData<Category[]>(categoryKeys.lists());
			const previousCategory = queryClient.getQueryData<Category>(categoryKeys.detail(id));

			queryClient.setQueryData(categoryKeys.lists(), (old: Category[] | undefined) => {
				if (!old) return old;
				return old.map((c) => (c.id === id ? { ...c, ...data } : c));
			});

			queryClient.setQueryData(categoryKeys.detail(id), (old: Category | undefined) => {
				if (!old) return old;
				return { ...old, ...data };
			});

			return { previousCategories, previousCategory };
		},
		onError: (err, { id }, context) => {
			if (context?.previousCategories) {
				queryClient.setQueryData(categoryKeys.lists(), context.previousCategories);
			}
			if (context?.previousCategory) {
				queryClient.setQueryData(categoryKeys.detail(id), context.previousCategory);
			}
			toast.error(resolveErrorMessage(err));
		},
		onSettled: (_data, _error, { id }) => {
			queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
			queryClient.invalidateQueries({ queryKey: categoryKeys.trees() });
			queryClient.invalidateQueries({ queryKey: categoryKeys.detail(id) });
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
