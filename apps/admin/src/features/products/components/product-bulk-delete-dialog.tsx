import { Delete01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/shared/components/dialog/confirm-dialog";
import { useBulkDeleteProducts } from "../hooks";
import type { Product } from "../model";

interface ProductBulkDeleteDialogProps {
	selectedProducts: Product[];
}

export function ProductBulkDeleteDialog({ selectedProducts }: ProductBulkDeleteDialogProps) {
	const [isOpen, setIsOpen] = useState(false);
	const bulkDeleteProducts = useBulkDeleteProducts();
	const selectedCount = selectedProducts.length;

	const handleBulkDelete = useCallback(async () => {
		const ids = selectedProducts.map((p) => p.id);
		if (ids.length === 0) return;
		await bulkDeleteProducts.mutateAsync({ ids });
		setIsOpen(false);
	}, [selectedProducts, bulkDeleteProducts]);

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
				title={`Eliminar ${selectedCount} ${selectedCount === 1 ? "producto" : "productos"}`}
				description={`¿Estás seguro de que deseas eliminar los ${selectedCount} productos seleccionados? Las imágenes asociadas también se eliminarán.`}
				confirmText="Eliminar"
				isLoading={bulkDeleteProducts.isPending}
				variant="destructive"
			/>
		</>
	);
}
