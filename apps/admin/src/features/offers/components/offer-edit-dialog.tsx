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
import { useOffer, useOfferProductsWithDetails, useUpdateOffer } from "../hooks";
import type { OfferFormValues } from "../validators";
import { OFFER_FORM_ID, OfferForm } from "./offer-form";

interface OfferEditDialogProps {
	offerId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function OfferEditDialog({ offerId, open, onOpenChange }: OfferEditDialogProps) {
	const updateOffer = useUpdateOffer();
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Fetch the offer ourselves so the route doesn't need to pass a full Offer.
	// When the dialog is closed, we skip the fetch.
	const activeId = open && offerId ? offerId : "";
	const { data: offer } = useOffer(activeId);
	const { data: offerProducts } = useOfferProductsWithDetails(activeId);

	const handleMutation = async (data: OfferFormValues) => {
		if (!offer) return;

		await updateOffer.mutateAsync({
			id: offer.id,
			data: {
				name: data.name,
				slug: data.slug,
				description: data.description ?? null,
				discountValue: data.discountValue,
				startsAt: data.startsAt?.toISOString(),
				endsAt: data.endsAt?.toISOString(),
				isActive: data.isActive ?? true,
				isFeatured: data.isFeatured ?? false,
				productIds: data.productIds ?? [],
			},
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-2xl p-0 gap-0 max-h-[85dvh] flex flex-col overflow-hidden"
				showCloseButton={false}
			>
				<DialogHeader className="shrink-0 p-4">
					<DialogTitle>Editar: {offer?.name ?? ""}</DialogTitle>
					<DialogDescription>Actualiza los datos de la oferta.</DialogDescription>
				</DialogHeader>

				{offer ? (
					<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
						<OfferForm
							key={offer.id}
							mode="edit"
							offer={{
								id: offer.id,
								name: offer.name,
								slug: offer.slug,
								description: offer.description,
								discountValue: offer.discountValue,
								startsAt: offer.startsAt,
								endsAt: offer.endsAt,
								isActive: offer.isActive ?? true,
								isFeatured: offer.isFeatured ?? false,
								productIds: offerProducts?.map((p) => p.productId) ?? [],
							}}
							onMutation={handleMutation}
							onSuccess={() => onOpenChange(false)}
							onSubmittingChange={setIsSubmitting}
						/>
					</div>
				) : null}

				<DialogFooter
					className="mx-0 mb-0 shrink-0 px-4 pb-4"
					showCloseButton
					closeLabel="Cancelar"
				>
					<Button type="submit" form={OFFER_FORM_ID} disabled={isSubmitting || !offer}>
						{isSubmitting ? "Guardando..." : "Guardar cambios"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
