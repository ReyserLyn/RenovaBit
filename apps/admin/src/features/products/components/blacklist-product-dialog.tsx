import { useQueryClient } from "@tanstack/react-query";
import { useAddToBlacklist } from "@/features/blacklist/hooks";
import { productKeys } from "@/features/products/hooks";
import { ConfirmDialog } from "@/shared/components/dialog/confirm-dialog";
import type { Product } from "../model";

const DEFAULT_SOURCE = "rematazo";

interface BlacklistProductDialogProps {
	product: Product | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function BlacklistProductDialog({
	product,
	open,
	onOpenChange,
}: BlacklistProductDialogProps) {
	const addToBlacklist = useAddToBlacklist();
	const queryClient = useQueryClient();

	const handleConfirm = async () => {
		if (!product || !product.providerIds?.length) return;

		try {
			// La API ya elimina el producto al añadirlo a la blacklist
			for (const provider of product.providerIds) {
				await addToBlacklist.mutateAsync({
					externalId: provider.externalId,
					source: provider.source || DEFAULT_SOURCE,
					productName: product.name,
				});
			}

			// Invalidar queries de productos para reflejar la eliminación
			queryClient.invalidateQueries({ queryKey: productKeys.all });

			onOpenChange(false);
		} catch {
			// El onError del hook ya muestra el toast
		}
	};

	const isPending = addToBlacklist.isPending;

	return (
		<ConfirmDialog
			isOpen={open}
			onClose={onOpenChange}
			onConfirm={handleConfirm}
			title="Añadir a lista negra"
			description={
				product
					? `¿Añadir "${product.name}" a la lista negra? Se bloqueará su ID de proveedor y se eliminará del catálogo. No volverá a importarse en futuros syncs.`
					: ""
			}
			confirmText="Añadir y eliminar"
			cancelText="Cancelar"
			isLoading={isPending}
			variant="destructive"
		/>
	);
}
