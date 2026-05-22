import { Delete01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/shared/components/dialog/confirm-dialog";
import { useBulkDeleteBrands } from "../hooks";
import type { Brand } from "../model";

interface BrandBulkDeleteDialogProps {
	selectedBrands: Brand[];
}

export function BrandBulkDeleteDialog({ selectedBrands }: BrandBulkDeleteDialogProps) {
	const [isOpen, setIsOpen] = useState(false);
	const bulkDeleteBrands = useBulkDeleteBrands();
	const selectedCount = selectedBrands.length;

	const handleBulkDelete = useCallback(async () => {
		const ids = selectedBrands.map((b) => b.id);
		if (ids.length === 0) return;

		await bulkDeleteBrands.mutateAsync({ ids });
		setIsOpen(false);
	}, [selectedBrands, bulkDeleteBrands]);

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
				title={`Eliminar ${selectedCount} ${selectedCount === 1 ? "marca" : "marcas"}`}
				description={`¿Estás seguro de que deseas eliminar las ${selectedCount} marcas seleccionadas? Esta acción no se puede deshacer.`}
				confirmText="Eliminar"
				isLoading={bulkDeleteBrands.isPending}
				variant="destructive"
			/>
		</>
	);
}
