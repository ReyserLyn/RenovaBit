import { Delete01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
} from "@renovabit/ui/components/ui/alert-dialog";

interface ConfirmDialogProps {
	isOpen: boolean;
	onClose: (open: boolean) => void;
	onConfirm: () => void | Promise<void>;
	title: string;
	description: string;
	confirmText?: string;
	cancelText?: string;
	isLoading?: boolean;
	variant?: "default" | "destructive";
}

/**
 * ConfirmDialog - Diálogo de confirmación genérico
 *
 * Uso:
 * ```tsx
 * <ConfirmDialog
 *   isOpen={isDeleteDialogOpen}
 *   onClose={() => setIsDeleteDialogOpen(false)}
 *   onConfirm={handleDelete}
 *   title="Eliminar marca"
 *   description="¿Estás seguro de que deseas eliminar esta marca? Esta acción no se puede deshacer."
 *   confirmText="Eliminar"
 *   variant="destructive"
 *   isLoading={isDeleting}
 * />
 * ```
 */
export function ConfirmDialog({
	isOpen,
	onClose,
	onConfirm,
	title,
	description,
	confirmText = "Confirmar",
	cancelText = "Cancelar",
	isLoading = false,
	variant = "default",
}: ConfirmDialogProps) {
	return (
		<AlertDialog
			open={isOpen}
			onOpenChange={(nextOpen) => {
				// Prevent accidental closure while async action is running.
				if (!nextOpen && isLoading) {
					return;
				}
				onClose(nextOpen);
			}}
		>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					{variant === "destructive" && (
						<AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
							<HugeiconsIcon icon={Delete01Icon} />
						</AlertDialogMedia>
					)}
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel variant="ghost" disabled={isLoading}>
						{cancelText}
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={(event) => {
							// Keep dialog open until mutation resolves and parent closes explicitly.
							event.preventDefault();
							Promise.resolve(onConfirm()).catch(() => {
								// Error ya manejado por el hook de la mutation (toast).
								// El catch evita unhandled promise rejection.
							});
						}}
						disabled={isLoading}
						variant={variant === "destructive" ? "destructive" : "default"}
					>
						{isLoading ? "Procesando..." : confirmText}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
