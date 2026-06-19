import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { OfferCreateDialog } from "@/features/offers/components/offer-create-dialog";
import { OfferDetailDialog } from "@/features/offers/components/offer-detail-dialog";
import { OfferEditDialog } from "@/features/offers/components/offer-edit-dialog";
import { OfferList } from "@/features/offers/components/offer-list";
import { useDeleteOffer, useToggleOfferActive } from "@/features/offers/hooks";
import type { OfferListItem } from "@/features/offers/service/offers.service";
import { ConfirmDialog } from "@/shared/components/dialog/confirm-dialog";
import { PageHeader } from "@/shared/components/layout/page-header";

export const Route = createFileRoute("/_authenticated/ofertas")({
	component: OfertasPage,
});

function OfertasPage() {
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [editOfferId, setEditOfferId] = useState<string | null>(null);
	const [detailOfferId, setDetailOfferId] = useState<string | null>(null);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<OfferListItem | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const deleteOffer = useDeleteOffer();
	const toggleActive = useToggleOfferActive();

	const handleEdit = useCallback((offer: OfferListItem) => {
		setEditOfferId(offer.id);
	}, []);

	const handleViewProducts = useCallback((offer: OfferListItem) => {
		setDetailOfferId(offer.id);
	}, []);

	const handleDelete = useCallback((offer: OfferListItem) => {
		setDeleteTarget(offer);
		setIsDeleteDialogOpen(true);
	}, []);

	const handleToggleActive = useCallback(
		(offer: OfferListItem) => {
			toggleActive.mutate({ id: offer.id, isActive: !offer.isActive });
		},
		[toggleActive],
	);

	const handleConfirmDelete = useCallback(async () => {
		if (!deleteTarget) return;
		setIsDeleting(true);
		try {
			await deleteOffer.mutateAsync(deleteTarget.id);
			setIsDeleteDialogOpen(false);
			setDeleteTarget(null);
		} finally {
			setIsDeleting(false);
		}
	}, [deleteTarget, deleteOffer]);

	const handleDetailEdit = useCallback((id: string) => {
		setDetailOfferId(null);
		setEditOfferId(id);
	}, []);

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Ofertas"
				description="Gestiona las ofertas y descuentos que se muestran en la tienda."
				actions={
					<Button onClick={() => setIsCreateDialogOpen(true)}>
						<HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
						Nueva oferta
					</Button>
				}
			/>

			<OfferCreateDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />

			<OfferEditDialog
				offerId={editOfferId}
				open={editOfferId !== null}
				onOpenChange={(open) => {
					if (!open) setEditOfferId(null);
				}}
			/>

			<OfferDetailDialog
				offerId={detailOfferId}
				open={detailOfferId !== null}
				onOpenChange={(open) => {
					if (!open) setDetailOfferId(null);
				}}
				onEdit={handleDetailEdit}
			/>

			<ConfirmDialog
				isOpen={isDeleteDialogOpen}
				onClose={(open) => {
					setIsDeleteDialogOpen(false);
					if (!open) setDeleteTarget(null);
				}}
				onConfirm={handleConfirmDelete}
				title={deleteTarget?.isActive ? "Eliminar oferta activa" : "Eliminar oferta"}
				description={
					deleteTarget?.isActive
						? `La oferta "${deleteTarget?.name ?? ""}" está activa. Al eliminarla se quitará de la tienda. Esta acción no se puede deshacer.`
						: `¿Estás seguro de que deseas eliminar la oferta "${deleteTarget?.name ?? ""}"? Esta acción no se puede deshacer.`
				}
				confirmText="Eliminar"
				variant="destructive"
				isLoading={isDeleting}
			/>

			<OfferList
				onEdit={handleEdit}
				onViewProducts={handleViewProducts}
				onDelete={handleDelete}
				onToggleActive={handleToggleActive}
			/>
		</div>
	);
}
