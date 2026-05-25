import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiClientError } from "@/shared/lib/api/api-errors";
import type { BulkDeleteValues, CreateProductValues, UpdateProductValues } from "../model";
import { productsService } from "../service/products.service";
import { productKeys } from "./products-queries";

// ── Helpers ────────────────────────────────────────────

function resolveErrorMessage(error: unknown): string {
	if (error instanceof ApiClientError) return error.message;
	if (error instanceof Error) return error.message;
	return "Error inesperado";
}

// ── Mutations ──────────────────────────────────────────

export function useCreateProduct() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: CreateProductValues) => productsService.create(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: productKeys.lists() });
			toast.success("Producto creado correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useUpdateProduct() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateProductValues }) =>
			productsService.update(id, data),
		onSuccess: (_data, { id }) => {
			queryClient.invalidateQueries({ queryKey: productKeys.lists() });
			queryClient.invalidateQueries({ queryKey: productKeys.detail(id) });
			toast.success("Producto actualizado correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useDeleteProduct() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => productsService.delete(id),
		onSuccess: (_data, id) => {
			queryClient.removeQueries({ queryKey: productKeys.detail(id) });
			queryClient.invalidateQueries({ queryKey: productKeys.lists() });
			toast.success("Producto eliminado correctamente");
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}

export function useBulkDeleteProducts() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: BulkDeleteValues) => productsService.deleteMany(data),
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: productKeys.lists() });
			queryClient.invalidateQueries({ queryKey: productKeys.details() });

			if (result.notFoundIds.length > 0) {
				toast.warning(
					`Se eliminaron ${result.deletedCount} productos. ${result.notFoundIds.length} no ${result.notFoundIds.length === 1 ? "fue" : "fueron"} encontrado${result.notFoundIds.length === 1 ? "" : "s"}.`,
				);
			} else {
				toast.success(
					`${result.deletedCount} ${result.deletedCount === 1 ? "producto eliminado" : "productos eliminados"} correctamente.`,
				);
			}
		},
		onError: (error) => {
			toast.error(resolveErrorMessage(error));
		},
	});
}
