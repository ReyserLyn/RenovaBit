import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/shared/components/layout/page-header";

export const Route = createFileRoute("/_authenticated/ventas")({
	component: VentasPage,
});

function VentasPage() {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Ventas e informes"
				description="Estadísticas de ventas, reportes de sincronización y actividad del sistema."
			/>
			<div className="rounded-lg border p-8 text-center">
				<p className="text-muted-foreground text-sm">Sección en desarrollo.</p>
			</div>
		</div>
	);
}
