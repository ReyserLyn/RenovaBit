import { ConfirmDialog } from "@/shared/components/dialog/confirm-dialog";
import { useDeleteProduct } from "../hooks";
import type { Product } from "../model";

interface ProductDeleteDialogProps {
	product: Product | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ProductDeleteDialog({ product, open, onOpenChange }: ProductDeleteDialogProps) {
	const deleteProduct = useDeleteProduct();

	const handleConfirm = async () => {
		if (!product) return;
		try {
			await deleteProduct.mutateAsync(product.id);
			onOpenChange(false);
		} catch {
			// El onError del hook ya muestra el toast.
		}
	};

	return (
		<ConfirmDialog
			isOpen={open}
			onClose={onOpenChange}
			onConfirm={handleConfirm}
			title="Eliminar producto"
			description={
				product
					? `¿Estás seguro de que deseas eliminar "${product.name}"? Esta acción no se puede deshacer. Las imágenes asociadas también se eliminarán.`
					: ""
			}
			confirmText="Eliminar"
			cancelText="Cancelar"
			isLoading={deleteProduct.isPending}
			variant="destructive"
		/>
	);
}
