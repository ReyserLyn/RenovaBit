import { ConfirmDialog } from "@/shared/components/dialog/confirm-dialog";
import { useDeleteCategory } from "../hooks";
import type { Category } from "../model";

interface CategoryDeleteDialogProps {
	category: Category | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CategoryDeleteDialog({ category, open, onOpenChange }: CategoryDeleteDialogProps) {
	const deleteCategory = useDeleteCategory();

	const handleConfirm = async () => {
		if (!category) return;

		try {
			await deleteCategory.mutateAsync(category.id);
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
			title="Eliminar categoría"
			description={
				category
					? `¿Estás seguro de que deseas eliminar "${category.name}"? Esta acción no se puede deshacer. Las subcategorías se quedarán sin padre.`
					: ""
			}
			confirmText="Eliminar"
			cancelText="Cancelar"
			isLoading={deleteCategory.isPending}
			variant="destructive"
		/>
	);
}
