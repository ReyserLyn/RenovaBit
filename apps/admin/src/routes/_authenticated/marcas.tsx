import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { BrandCreateDialog } from "@/features/brands/components/brand-create-dialog";
import { BrandDeleteDialog } from "@/features/brands/components/brand-delete-dialog";
import { BrandEditDialog } from "@/features/brands/components/brand-edit-dialog";
import { BrandTable } from "@/features/brands/components/brand-table";
import type { Brand } from "@/features/brands/model";
import { PageHeader } from "@/shared/components/layout/page-header";

export const Route = createFileRoute("/_authenticated/marcas")({
	component: MarcasPage,
});

function MarcasPage() {
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

	const handleEdit = useCallback((brand: Brand) => {
		setSelectedBrand(brand);
		setIsEditDialogOpen(true);
	}, []);

	const handleDelete = useCallback((brand: Brand) => {
		setSelectedBrand(brand);
		setIsDeleteDialogOpen(true);
	}, []);

	return (
		<div className="flex flex-col gap-6">
			{/* Header */}
			<PageHeader
				title="Marcas"
				description="Gestiona las marcas asociadas a tus productos."
				actions={
					<Button onClick={() => setIsCreateDialogOpen(true)}>
						<HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
						Nueva marca
					</Button>
				}
			/>

			{/* Dialogs */}
			<BrandCreateDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />

			<BrandEditDialog
				brand={selectedBrand}
				open={isEditDialogOpen}
				onOpenChange={setIsEditDialogOpen}
			/>

			<BrandDeleteDialog
				brand={selectedBrand}
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			/>

			{/* Table */}
			<BrandTable onEdit={handleEdit} onDelete={handleDelete} />
		</div>
	);
}
