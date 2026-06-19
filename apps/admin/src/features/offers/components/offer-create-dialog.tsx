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
import { useCreateOffer } from "../hooks";
import type { OfferFormValues } from "../validators";
import { OFFER_FORM_ID, OfferForm } from "./offer-form";

interface OfferCreateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function OfferCreateDialog({ open, onOpenChange }: OfferCreateDialogProps) {
	const createOffer = useCreateOffer();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleMutation = async (data: OfferFormValues) => {
		await createOffer.mutateAsync({
			name: data.name,
			slug: data.slug,
			description: data.description ?? null,
			discountValue: data.discountValue,
			startsAt: data.startsAt?.toISOString() ?? new Date().toISOString(),
			endsAt:
				data.endsAt?.toISOString() ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
			isActive: data.isActive ?? true,
			isFeatured: data.isFeatured ?? false,
			productIds: data.productIds ?? [],
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-2xl p-0 gap-0 max-h-[85dvh] flex flex-col overflow-hidden"
				showCloseButton={false}
			>
				<DialogHeader className="shrink-0 p-4">
					<DialogTitle>Nueva oferta</DialogTitle>
					<DialogDescription>Crea una nueva oferta o promoción para la tienda.</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
					<OfferForm
						defaultValues={{
							name: "",
							slug: "",
							description: "",
							discountValue: 0,
							startsAt: undefined,
							endsAt: undefined,
							isActive: true,
							isFeatured: false,
							productIds: [],
						}}
						onMutation={handleMutation}
						onSuccess={() => onOpenChange(false)}
						onSubmittingChange={setIsSubmitting}
					/>
				</div>

				<DialogFooter
					className="mx-0 mb-0 shrink-0 px-4 pb-4"
					showCloseButton
					closeLabel="Cancelar"
				>
					<Button type="submit" form={OFFER_FORM_ID} disabled={isSubmitting}>
						{isSubmitting ? "Creando oferta..." : "Crear oferta"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
