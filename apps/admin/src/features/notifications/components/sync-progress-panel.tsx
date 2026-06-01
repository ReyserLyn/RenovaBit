import { Progress } from "@renovabit/ui/components/ui/progress";
import { useSidebar } from "@renovabit/ui/components/ui/sidebar";
import { cn } from "@renovabit/ui/lib/utils";
import { useNotifications } from "../context/notifications-context";

export function SyncProgressPanel() {
	const { progress } = useNotifications();
	const { state: sidebarState } = useSidebar();
	const isSidebarExpanded = sidebarState === "expanded";

	if (!progress) return null;

	const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

	return (
		<div
			role="status"
			aria-live="polite"
			aria-label="Progreso de sincronización"
			className={cn(
				"fixed bottom-4 z-50 w-80 rounded-lg border bg-background p-4 shadow-lg transition-all",
				isSidebarExpanded ? "right-[calc(1rem+var(--sidebar-width))]" : "right-4",
			)}
		>
			<div className="flex items-center justify-between mb-2">
				<span className="text-sm font-medium">Sincronizando...</span>
				<span className="text-xs text-muted-foreground">
					{progress.processed}/{progress.total} ({pct}%)
				</span>
			</div>
			<Progress value={pct} className="h-2" />
			<div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
				<span>Creados: {progress.created}</span>
				<span>Actualizados: {progress.updated}</span>
				<span>Sin cambios: {progress.unchanged}</span>
				<span>Errores: {progress.errors}</span>
			</div>
		</div>
	);
}
