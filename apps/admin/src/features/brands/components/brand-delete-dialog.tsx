import { ConfirmDialog } from "@/shared/components/dialog/confirm-dialog";
import { useDeleteBrand } from "../hooks";
import type { Brand } from "../model";

interface BrandDeleteDialogProps {
	brand: Brand | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function BrandDeleteDialog({ brand, open, onOpenChange }: BrandDeleteDialogProps) {
	const deleteBrand = useDeleteBrand();

	const handleConfirm = async () => {
		if (!brand) return;

		try {
			await deleteBrand.mutateAsync(brand.id);
			onOpenChange(false);
		} catch {
			// El onError del hook ya muestra el toast.
			// El diálogo se queda abierto para que el usuario pueda reintentar.
		}
	};

	return (
		<ConfirmDialog
			isOpen={open}
			onClose={onOpenChange}
			onConfirm={handleConfirm}
			title="Eliminar marca"
			description={
				brand
					? `¿Estás seguro de que deseas eliminar "${brand.name}"? Esta acción no se puede deshacer. Los productos asociados perderán esta marca.`
					: ""
			}
			confirmText="Eliminar"
			cancelText="Cancelar"
			isLoading={deleteBrand.isPending}
			variant="destructive"
		/>
	);
}
