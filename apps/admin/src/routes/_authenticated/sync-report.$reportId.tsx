import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/sync-report/$reportId")({
	component: SyncReportPage,
});

function SyncReportPage() {
	const { reportId } = Route.useParams();

	return (
		<div className="flex flex-1 flex-col min-h-0">
			<h2 className="text-lg font-semibold mb-4">Reporte de sincronización</h2>
			<div className="rounded-lg border p-8 text-center">
				<p className="text-muted-foreground text-sm font-mono">{reportId}</p>
				<p className="text-muted-foreground text-sm mt-2">
					Detalle de cambios de productos próximamente.
				</p>
			</div>
		</div>
	);
}
