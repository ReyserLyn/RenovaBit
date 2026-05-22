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
import { useCreateCategory } from "../hooks";
import { CATEGORY_FORM_ID, CategoryForm } from "./category-form";

interface CategoryCreateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CategoryCreateDialog({ open, onOpenChange }: CategoryCreateDialogProps) {
	const createCategory = useCreateCategory();
	const [isSubmitting, setIsSubmitting] = useState(false);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-lg p-0 gap-0 max-h-[85dvh] flex flex-col overflow-hidden"
				showCloseButton={false}
			>
				<DialogHeader className="shrink-0 p-4">
					<DialogTitle>Nueva categoría</DialogTitle>
					<DialogDescription>
						Crea una nueva categoría para organizar tus productos.
					</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
					<CategoryForm
						defaultValues={{
							name: "",
							slug: "",
							description: "",
							parentId: undefined,
							sortOrder: 0,
							isFeatured: false,
							isActive: true,
							isVisibleInNav: true,
							seoTitle: "",
							seoDescription: "",
							seoKeywords: "",
						}}
						onMutation={(data) => createCategory.mutateAsync(data)}
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
						{isSubmitting ? "Creando categoría..." : "Crear categoría"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
