import { ConfirmDialog } from "@/shared/components/dialog/confirm-dialog";
import { useRemoveFromBlacklist } from "../hooks";
import type { BlacklistEntry } from "../model";

interface RevertBlacklistDialogProps {
	entry: BlacklistEntry | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function RevertBlacklistDialog({ entry, open, onOpenChange }: RevertBlacklistDialogProps) {
	const removeFromBlacklist = useRemoveFromBlacklist();

	const handleConfirm = async () => {
		if (!entry) return;

		try {
			await removeFromBlacklist.mutateAsync({
				externalId: entry.externalId,
				source: entry.source,
			});
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
			title="Revertir de la lista negra"
			description={
				entry
					? `¿Quitar "${entry.externalId}" de la lista negra? Volverá a poder sincronizarse en el próximo sync${entry.productName ? ` (${entry.productName})` : ""}.`
					: ""
			}
			confirmText="Revertir"
			cancelText="Cancelar"
			isLoading={removeFromBlacklist.isPending}
		/>
	);
}
