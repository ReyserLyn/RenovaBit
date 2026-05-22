import { Logout01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogMedia,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@renovabit/ui/components/ui/alert-dialog";
import { type ReactElement } from "react";
import { useLogout } from "@/features/auth/hooks/use-logout";

interface LogoutDialogProps {
	/** ReactElement para usar como trigger (botón, menú item, etc.) */
	children?: ReactElement;
	/** Control externo — cuando no hay trigger, se usa open/onOpenChange */
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function LogoutDialog({ children, open, onOpenChange }: LogoutDialogProps) {
	const { logout, isLoggingOut } = useLogout();

	const dialog = (
		<AlertDialogContent size="sm" className="gap-0 overflow-hidden p-0 sm:max-w-sm">
			<div className="flex flex-col items-center justify-center gap-2 p-8">
				<AlertDialogMedia className="size-12 rounded-full bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
					<HugeiconsIcon icon={Logout01Icon} className="size-6" />
				</AlertDialogMedia>
				<AlertDialogTitle className="text-center text-base font-semibold">
					¿Cerrar sesión?
				</AlertDialogTitle>
				<AlertDialogDescription className="p-0 text-center text-sm font-medium">
					Puedes volver a iniciar sesión cuando quieras.
				</AlertDialogDescription>
			</div>
			<AlertDialogFooter className="grid flex-none grid-cols-2 gap-0 divide-x border-t pt-0">
				<AlertDialogCancel
					variant="ghost"
					className="h-12 flex-1 rounded-none border-0 p-0"
					disabled={isLoggingOut}
				>
					Cancelar
				</AlertDialogCancel>
				<AlertDialogAction
					variant="ghost"
					className="h-12 flex-1 rounded-none border-0 p-0 text-destructive hover:text-destructive"
					disabled={isLoggingOut}
					onClick={(e) => {
						e.preventDefault();
						Promise.resolve(logout()).finally(() => onOpenChange?.(false));
					}}
				>
					{isLoggingOut ? "Cerrando sesión…" : "Sí, cerrar sesión"}
				</AlertDialogAction>
			</AlertDialogFooter>
		</AlertDialogContent>
	);

	// Si tiene trigger children, usa el patrón con AlertDialogTrigger
	if (children) {
		return (
			<AlertDialog>
				<AlertDialogTrigger render={children} />
				{dialog}
			</AlertDialog>
		);
	}

	// Si no, usa control externo (open/onOpenChange)
	return (
		<AlertDialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen && isLoggingOut) return;
				onOpenChange?.(nextOpen);
			}}
		>
			{dialog}
		</AlertDialog>
	);
}
