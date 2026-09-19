import { ReloadIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { SyncReportDetailDialog } from "@/features/sync-reports/components/sync-report-detail-dialog";
import { SyncReportsTable } from "@/features/sync-reports/components/sync-reports-table";
import { useRunSync } from "@/features/sync-reports/hooks/sync-reports-mutations";
import { ConfirmDialog } from "@/shared/components/dialog/confirm-dialog";
import { PageHeader } from "@/shared/components/layout/page-header";

export const Route = createFileRoute("/_authenticated/sincronizaciones")({
	component: SincronizacionesPage,
});

function SincronizacionesPage() {
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
	const runSync = useRunSync();

	const handleConfirmRun = useCallback(async () => {
		try {
			await runSync.mutateAsync(undefined);
		} finally {
			setConfirmOpen(false);
		}
	}, [runSync]);

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Sincronizaciones"
				description="Ejecuciones del sync con el proveedor: estado, contadores, costo de IA y errores."
				actions={
					<Button onClick={() => setConfirmOpen(true)}>
						<HugeiconsIcon icon={ReloadIcon} className="mr-2 h-4 w-4" />
						Ejecutar sync ahora
					</Button>
				}
			/>

			<SyncReportsTable onRowClick={(report) => setSelectedReportId(report.id)} />

			<ConfirmDialog
				isOpen={confirmOpen}
				onClose={setConfirmOpen}
				onConfirm={handleConfirmRun}
				title="Ejecutar sync ahora"
				description="Se encolará una sincronización manual con el feed del proveedor. Si ya hay un sync en curso (o terminó hace menos de 2 segundos), el job se omitirá automáticamente."
				confirmText="Ejecutar sync"
				isLoading={runSync.isPending}
			/>

			<SyncReportDetailDialog
				key={selectedReportId ?? "none"}
				reportId={selectedReportId}
				open={selectedReportId !== null}
				onOpenChange={(open) => {
					if (!open) setSelectedReportId(null);
				}}
			/>
		</div>
	);
}
