import { Button } from "@renovabit/ui/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@renovabit/ui/components/ui/dialog";
import { useState } from "react";
import { useUpdateProduct } from "../hooks";
import type { Product } from "../model";
import { PRODUCT_FORM_ID, ProductForm } from "./product-form";

interface ProductEditDialogProps {
	product: Product | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ProductEditDialog({ product, open, onOpenChange }: ProductEditDialogProps) {
	const updateProduct = useUpdateProduct();
	const [isSubmitting, setIsSubmitting] = useState(false);

	return (
		<Dialog open={open && product !== null} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-2xl p-0 gap-0 max-h-[85dvh] flex flex-col overflow-hidden"
				showCloseButton={false}
			>
				<DialogHeader className="shrink-0 p-4">
					<DialogTitle>Editar: {product?.name ?? ""}</DialogTitle>
					<DialogDescription>Actualiza los datos del producto.</DialogDescription>
				</DialogHeader>

				{product && (
					<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
						<ProductForm
							key={product.id}
							mode="edit"
							product={{
								id: product.id,
								name: product.name,
								slug: product.slug,
								description: product.description,
								sku: product.sku,
								price: product.price,
								stock: product.stock,
								brandId: product.brandId,
								categoryId: product.categoryId,
								specifications: product.specifications ?? [],
								isActive: product.isActive,
								isFeatured: product.isFeatured,
								seoTitle: product.seoTitle,
								seoDescription: product.seoDescription,
								seoKeywords: product.seoKeywords,
							}}
							onMutation={(data) => updateProduct.mutateAsync({ id: product.id, data })}
							onSuccess={() => onOpenChange(false)}
							onSubmittingChange={setIsSubmitting}
						/>
					</div>
				)}

				<DialogFooter
					className="mx-0 mb-0 shrink-0 px-4 pb-4"
					showCloseButton
					closeLabel="Cancelar"
				>
					<Button type="submit" form={PRODUCT_FORM_ID} disabled={isSubmitting || !product}>
						{isSubmitting ? "Guardando..." : "Guardar cambios"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
