import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { ProductCreateDialog } from "@/features/products/components/product-create-dialog";
import { ProductDeleteDialog } from "@/features/products/components/product-delete-dialog";
import { ProductEditDialog } from "@/features/products/components/product-edit-dialog";
import { ProductTable } from "@/features/products/components/product-table";
import type { Product } from "@/features/products/model";
import { PageHeader } from "@/shared/components/layout/page-header";

export const Route = createFileRoute("/_authenticated/productos")({
	component: ProductsPage,
});

function ProductsPage() {
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

	const handleEdit = useCallback((product: Product) => {
		setSelectedProduct(product);
		setIsEditDialogOpen(true);
	}, []);

	const handleDelete = useCallback((product: Product) => {
		setSelectedProduct(product);
		setIsDeleteDialogOpen(true);
	}, []);

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Productos"
				description="Gestiona el catálogo de productos de tu tienda."
				actions={
					<Button onClick={() => setIsCreateDialogOpen(true)}>
						<HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
						Nuevo producto
					</Button>
				}
			/>

			<ProductCreateDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />

			<ProductEditDialog
				product={selectedProduct}
				open={isEditDialogOpen}
				onOpenChange={setIsEditDialogOpen}
			/>

			<ProductDeleteDialog
				product={selectedProduct}
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			/>

			<ProductTable onEdit={handleEdit} onDelete={handleDelete} />
		</div>
	);
}
