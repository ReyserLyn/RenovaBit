import { Button } from "@renovabit/ui/components/ui/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback } from "react";
import { z } from "zod";
import { useProduct } from "@/features/products/hooks";
import { HistoryTable } from "@/features/reports/components/history-table";
import { RecentChangesTable } from "@/features/reports/components/recent-changes-table";
import { useProductChanges } from "@/features/reports/hooks/product-changes-queries";
import { PageHeader } from "@/shared/components/layout/page-header";

export const Route = createFileRoute("/_authenticated/historial")({
	validateSearch: z.object({
		producto: z.string().optional(),
	}),
	component: HistorialPage,
});

function HistorialPage() {
	const navigate = useNavigate();
	const [productId, setProductId] = useQueryState("producto", parseAsString);
	const { data: product } = useProduct(productId ?? "");
	const { data: changes, isPending } = useProductChanges(productId ?? "");

	const handleProductClick = useCallback(
		(clickedProductId: string) => {
			navigate({
				to: "/historial",
				search: { producto: clickedProductId },
			});
		},
		[navigate],
	);

	const handleClearProduct = useCallback(() => {
		setProductId(null);
	}, [setProductId]);

	// ── Modo: feed global (sin producto seleccionado) ──

	if (!productId) {
		return (
			<div className="flex flex-col gap-6">
				<PageHeader
					title="Historial de cambios"
					description="Cambios recientes en todos los productos. Haz clic en un producto para ver su historial completo."
				/>
				<RecentChangesTable onProductClick={handleProductClick} />
			</div>
		);
	}

	// ── Modo: detalle por producto ─────────────────────

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Historial de cambios"
				description={product ? `Producto: ${product.name}` : `Producto ${productId.slice(0, 8)}...`}
				actions={
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" onClick={handleClearProduct}>
							Ver todos los productos
						</Button>
						{product ? (
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									navigate({
										to: "/productos",
										search: { busqueda: product.sku ?? "" },
									})
								}
							>
								Ver en catálogo
							</Button>
						) : undefined}
					</div>
				}
			/>

			<HistoryTable changes={changes ?? []} isPending={isPending} />
		</div>
	);
}
