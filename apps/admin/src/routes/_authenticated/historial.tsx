import { Button } from "@renovabit/ui/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { parseAsString, useQueryState } from "nuqs";
import { useProduct } from "@/features/products/hooks";
import { HistoryTable } from "@/features/reports/components/history-table";
import { useProductChanges } from "@/features/reports/hooks/product-changes-queries";
import { PageHeader } from "@/shared/components/layout/page-header";

export const Route = createFileRoute("/_authenticated/historial")({
	validateSearch: (search: Record<string, unknown>) => ({
		producto: (search.producto as string) || undefined,
	}),
	component: HistorialPage,
});

function HistorialPage() {
	const [productId] = useQueryState("producto", parseAsString);
	const { data: product } = useProduct(productId ?? "");
	const { data: changes, isPending } = useProductChanges(productId ?? "");

	if (!productId) {
		return (
			<div className="flex flex-col gap-6">
				<PageHeader
					title="Historial de cambios"
					description="Selecciona un producto desde el catálogo para ver su historial."
				/>
				<div className="rounded-lg border p-8 text-center">
					<p className="text-muted-foreground text-sm">No se ha seleccionado ningún producto.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Historial de cambios"
				description={product ? `Producto: ${product.name}` : `Producto ${productId.slice(0, 8)}...`}
				actions={
					product ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								window.open(`/productos?busqueda=${encodeURIComponent(product.sku ?? "")}`, "_self")
							}
						>
							Ver en catálogo
						</Button>
					) : undefined
				}
			/>

			<HistoryTable changes={changes ?? []} isPending={isPending} />
		</div>
	);
}
