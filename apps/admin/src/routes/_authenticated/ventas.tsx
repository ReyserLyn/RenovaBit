import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/shared/components/layout/page-header";

export const Route = createFileRoute("/_authenticated/ventas")({
	component: VentasPage,
});

function VentasPage() {
	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Ventas"
				description="Esta sección todavía no tiene estadísticas de ventas. Los reportes de sincronización con el proveedor se consultan en Sincronizaciones."
			/>
			<div className="rounded-lg border p-8 text-center">
				<p className="text-muted-foreground text-sm">
					Sección en desarrollo: aún no hay informes de ventas ni métricas agregadas.
				</p>
				<Link
					to="/sincronizaciones"
					className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4"
				>
					Ver reportes de sincronización
				</Link>
			</div>
		</div>
	);
}
