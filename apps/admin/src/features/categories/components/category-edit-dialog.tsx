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
import { useUpdateCategory } from "../hooks";
import type { Category } from "../model";
import { CATEGORY_FORM_ID, CategoryForm } from "./category-form";

interface CategoryEditDialogProps {
	category: Category | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CategoryEditDialog({ category, open, onOpenChange }: CategoryEditDialogProps) {
	const updateCategory = useUpdateCategory();
	const [isSubmitting, setIsSubmitting] = useState(false);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{category && (
				<DialogContent
					className="sm:max-w-lg p-0 gap-0 max-h-[85dvh] flex flex-col overflow-hidden"
					showCloseButton={false}
				>
					<DialogHeader className="shrink-0 p-4">
						<DialogTitle>Editar: {category.name}</DialogTitle>
						<DialogDescription>
							Actualiza los datos de &ldquo;{category.name}&rdquo;.
						</DialogDescription>
					</DialogHeader>

					<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
						<CategoryForm
							key={category.id}
							mode="edit"
							category={{
								id: category.id,
								name: category.name,
								slug: category.slug,
								description: category.description,
								imageUrl: category.imageUrl,
								parentId: category.parentId,
								path: category.path,
								sortOrder: category.sortOrder,
								isFeatured: category.isFeatured,
								isActive: category.isActive,
								isVisibleInNav: category.isVisibleInNav,
								seoTitle: category.seoTitle,
								seoDescription: category.seoDescription,
								seoKeywords: category.seoKeywords,
							}}
							onMutation={(data) => updateCategory.mutateAsync({ id: category.id, data })}
							onSuccess={() => onOpenChange(false)}
							onSubmittingChange={setIsSubmitting}
						/>
					</div>

					<DialogFooter
						className="mx-0 mb-0 shrink-0 px-4 pb-4"
						showCloseButton
						closeLabel="Cancelar"
					>
						<Button type="submit" form={CATEGORY_FORM_ID} disabled={isSubmitting}>
							{isSubmitting ? "Guardando..." : "Guardar cambios"}
						</Button>
					</DialogFooter>
				</DialogContent>
			)}
		</Dialog>
	);
}
