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
import { useCreateProduct } from "../hooks";
import { PRODUCT_FORM_ID, ProductForm } from "./product-form";

interface ProductCreateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ProductCreateDialog({ open, onOpenChange }: ProductCreateDialogProps) {
	const createProduct = useCreateProduct();
	const [isSubmitting, setIsSubmitting] = useState(false);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-2xl p-0 gap-0 max-h-[85dvh] flex flex-col overflow-hidden"
				showCloseButton={false}
			>
				<DialogHeader className="shrink-0 p-4">
					<DialogTitle>Nuevo producto</DialogTitle>
					<DialogDescription>Crea un nuevo producto para añadir a tu catálogo.</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
					<ProductForm
						defaultValues={{
							name: "",
							slug: "",
							description: "",
							sku: "",
							price: "",
							stock: 0,
							brandId: undefined,
							categoryId: undefined,
							specifications: [],
							isActive: true,
							isFeatured: false,
							seoTitle: "",
							seoDescription: "",
							seoKeywords: "",
						}}
						onMutation={(data) => createProduct.mutateAsync(data)}
						onSuccess={() => onOpenChange(false)}
						onSubmittingChange={setIsSubmitting}
					/>
				</div>

				<DialogFooter
					className="mx-0 mb-0 shrink-0 px-4 pb-4"
					showCloseButton
					closeLabel="Cancelar"
				>
					<Button type="submit" form={PRODUCT_FORM_ID} disabled={isSubmitting}>
						{isSubmitting ? "Creando producto..." : "Crear producto"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
