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
import { useUpdateBrand } from "../hooks";
import type { Brand } from "../model";
import { BRAND_FORM_ID, BrandForm } from "./brand-form";

interface BrandEditDialogProps {
	brand: Brand | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function BrandEditDialog({ brand, open, onOpenChange }: BrandEditDialogProps) {
	const updateBrand = useUpdateBrand();
	const [isSubmitting, setIsSubmitting] = useState(false);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{brand && (
				<DialogContent
					className="sm:max-w-lg p-0 gap-0 max-h-[85dvh] flex flex-col overflow-hidden"
					showCloseButton={false}
				>
					<DialogHeader className="shrink-0 p-4">
						<DialogTitle>Editar: {brand.name}</DialogTitle>
						<DialogDescription>
							Actualiza los datos de &ldquo;{brand.name}&rdquo;.
						</DialogDescription>
					</DialogHeader>

					<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
						<BrandForm
							mode="edit"
							brand={{
								name: brand.name,
								slug: brand.slug,
								description: brand.description,
								imageUrl: brand.imageUrl,
								seoTitle: brand.seoTitle,
								seoDescription: brand.seoDescription,
								seoKeywords: brand.seoKeywords,
								isActive: brand.isActive,
								isFeatured: brand.isFeatured,
							}}
							onMutation={(data) => updateBrand.mutateAsync({ slug: brand.slug, data })}
							onSuccess={() => onOpenChange(false)}
							onSubmittingChange={setIsSubmitting}
						/>
					</div>

					<DialogFooter
						className="mx-0 mb-0 shrink-0 px-4 pb-4"
						showCloseButton
						closeLabel="Cancelar"
					>
						<Button type="submit" form={BRAND_FORM_ID} disabled={isSubmitting}>
							{isSubmitting ? "Guardando..." : "Guardar cambios"}
						</Button>
					</DialogFooter>
				</DialogContent>
			)}
		</Dialog>
	);
}
