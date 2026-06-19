import { Edit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@renovabit/ui/components/ui/dialog";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import { useOffer, useOfferProductsWithDetails } from "../hooks";
import { OfferView } from "./offer-detail";

// ── Props ──

interface OfferDetailDialogProps {
	offerId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onEdit?: (id: string) => void;
}

// ── Component ──

export function OfferDetailDialog({ offerId, open, onOpenChange, onEdit }: OfferDetailDialogProps) {
	const {
		data: offer,
		isPending: isOfferPending,
		isError: isOfferError,
		error: offerError,
	} = useOffer(offerId ?? "");

	const {
		data: products,
		isPending: isProductsPending,
		isError: isProductsError,
	} = useOfferProductsWithDetails(offerId ?? "");

	const isLoading = isOfferPending;
	const isError = isOfferError || isProductsError;
	const errorMessage =
		offerError instanceof Error ? offerError.message : "No se pudo cargar la oferta.";

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next && isLoading) return;
				onOpenChange(next);
			}}
		>
			<DialogContent className="sm:max-w-3xl p-0 gap-0 max-h-[90dvh] flex flex-col overflow-hidden">
				{isLoading ? (
					<div className="p-8 space-y-4">
						<Skeleton className="h-6 w-48" />
						<Skeleton className="h-4 w-64" />
						<Skeleton className="h-32 w-full" />
						<Skeleton className="h-32 w-full" />
					</div>
				) : isError || !offer ? (
					<div className="p-8">
						<DialogHeader>
							<DialogTitle>Error</DialogTitle>
							<DialogDescription>{errorMessage}</DialogDescription>
						</DialogHeader>
						<div className="mt-4">
							<Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
								Cerrar
							</Button>
						</div>
					</div>
				) : (
					<>
						<DialogHeader className="shrink-0 p-6 pb-2">
							<div className="flex items-center gap-3 flex-wrap">
								<DialogTitle className="text-lg">{offer.name}</DialogTitle>
							</div>
							<DialogDescription>Detalle de la oferta y sus productos asignados.</DialogDescription>
						</DialogHeader>

						<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
							<OfferView
								offer={offer}
								products={products ?? []}
								isProductsPending={isProductsPending}
								isProductsError={isProductsError}
							/>
						</div>

						<DialogFooter
							className="shrink-0 px-6 pb-6 pt-2 border-t"
							showCloseButton
							closeLabel="Cerrar"
						>
							{onEdit && (
								<Button
									variant="default"
									onClick={() => {
										onOpenChange(false);
										if (offerId) onEdit(offerId);
									}}
								>
									<HugeiconsIcon icon={Edit01Icon} className="size-4" />
									Editar
								</Button>
							)}
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
