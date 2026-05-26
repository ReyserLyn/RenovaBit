import { Delete01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { useState } from "react";
import { ConfirmDialog } from "@/shared/components/dialog/confirm-dialog";
import { useBulkDeleteCategories } from "../hooks";
import type { Category } from "../model";

interface CategoryBulkDeleteDialogProps {
	selectedCategories: Category[];
}

export function CategoryBulkDeleteDialog({ selectedCategories }: CategoryBulkDeleteDialogProps) {
	const [isOpen, setIsOpen] = useState(false);
	const bulkDeleteCategories = useBulkDeleteCategories();
	const selectedCount = selectedCategories.length;

	async function handleBulkDelete() {
		const ids = selectedCategories.map((c) => c.id);
		if (ids.length === 0) return;

		await bulkDeleteCategories.mutateAsync({ ids });
		setIsOpen(false);
	}

	if (selectedCount === 0) return null;

	return (
		<>
			<Button
				type="button"
				variant="destructive"
				size="sm"
				className="h-8"
				onClick={() => setIsOpen(true)}
			>
				<HugeiconsIcon icon={Delete01Icon} className="mr-1.5 size-4" />
				Eliminar ({selectedCount})
			</Button>

			<ConfirmDialog
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				onConfirm={handleBulkDelete}
				title={`Eliminar ${selectedCount} ${selectedCount === 1 ? "categoría" : "categorías"}`}
				description={`¿Estás seguro de que deseas eliminar las ${selectedCount} categorías seleccionadas? Solo se eliminarán las que no tengan subcategorías.`}
				confirmText="Eliminar"
				isLoading={bulkDeleteCategories.isPending}
				variant="destructive"
			/>
		</>
	);
}
