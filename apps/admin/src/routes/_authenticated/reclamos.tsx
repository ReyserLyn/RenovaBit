import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ComplaintDetailDialog } from "@/features/complaints/components/complaint-detail-dialog";
import { ComplaintTable } from "@/features/complaints/components/complaint-table";
import { PageHeader } from "@/shared/components/layout/page-header";

function ReclamosPage() {
	const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
	const [isDetailOpen, setIsDetailOpen] = useState(false);

	const handleViewDetail = (complaintId: string) => {
		setSelectedComplaintId(complaintId);
		setIsDetailOpen(true);
	};

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Libro de Reclamaciones"
				description="Atiende los reclamos y quejas registrados en la tienda y deja constancia de la respuesta."
			/>

			<ComplaintTable onViewDetail={handleViewDetail} />

			<ComplaintDetailDialog
				complaintId={selectedComplaintId}
				open={isDetailOpen}
				onOpenChange={setIsDetailOpen}
			/>
		</div>
	);
}

export const Route = createFileRoute("/_authenticated/reclamos")({
	component: ReclamosPage,
});
