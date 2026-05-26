import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { resolveErrorMessage } from "@/shared/lib/api/error-utils";
import type { BulkDeleteValues, CreateProductValues, Product, UpdateProductValues } from "../model";
import { productsService } from "../service/products.service";
import { productKeys } from "./products-queries";

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

export function useToggleProductField() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateProductValues }) =>
			productsService.update(id, data),
		onMutate: async ({ id, data }) => {
			await queryClient.cancelQueries({ queryKey: productKeys.lists() });
			await queryClient.cancelQueries({ queryKey: productKeys.detail(id) });
			const previousProducts = queryClient.getQueryData<Product[]>(productKeys.lists());
			const previousProduct = queryClient.getQueryData<Product>(productKeys.detail(id));

			queryClient.setQueryData(productKeys.lists(), (old: Product[] | undefined) => {
				if (!old) return old;
				return old.map((p) => (p.id === id ? { ...p, ...data } : p));
			});

			queryClient.setQueryData(productKeys.detail(id), (old: Product | undefined) => {
				if (!old) return old;
				return { ...old, ...data };
			});

			return { previousProducts, previousProduct };
		},
		onError: (err, { id }, context) => {
			if (context?.previousProducts) {
				queryClient.setQueryData(productKeys.lists(), context.previousProducts);
			}
			if (context?.previousProduct) {
				queryClient.setQueryData(productKeys.detail(id), context.previousProduct);
			}
			toast.error(resolveErrorMessage(err));
		},
		onSettled: (_data, _error, { id }) => {
			queryClient.invalidateQueries({ queryKey: productKeys.lists() });
			queryClient.invalidateQueries({ queryKey: productKeys.detail(id) });
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
