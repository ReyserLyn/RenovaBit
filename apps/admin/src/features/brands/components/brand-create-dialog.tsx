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
import { useCreateBrand } from "../hooks";
import { BRAND_FORM_ID, BrandForm } from "./brand-form";

interface BrandCreateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function BrandCreateDialog({ open, onOpenChange }: BrandCreateDialogProps) {
	const createBrand = useCreateBrand();
	const [isSubmitting, setIsSubmitting] = useState(false);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-lg p-0 gap-0 max-h-[85dvh] flex flex-col overflow-hidden"
				showCloseButton={false}
			>
				<DialogHeader className="shrink-0 p-4">
					<DialogTitle>Nueva marca</DialogTitle>
					<DialogDescription>Crea una nueva marca para asociar a tus productos.</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
					<BrandForm
						defaultValues={{
							name: "",
							slug: "",
							description: "",
							seoTitle: "",
							seoDescription: "",
							seoKeywords: "",
							isActive: true,
							isFeatured: false,
						}}
						onMutation={(data) => createBrand.mutateAsync(data)}
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
						{isSubmitting ? "Creando marca..." : "Crear marca"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
