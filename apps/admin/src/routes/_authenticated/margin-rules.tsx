import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { MarginRuleCreateDialog } from "@/features/margin-rules/components/margin-rule-create-dialog";
import { MarginRuleEditDialog } from "@/features/margin-rules/components/margin-rule-edit-dialog";
import { MarginRuleList } from "@/features/margin-rules/components/margin-rule-list";
import { useDeleteMarginRule, useMarginRules } from "@/features/margin-rules/hooks";
import type { MarginRule } from "@/features/margin-rules/service/margin-rules.service";
import { ConfirmDialog } from "@/shared/components/dialog/confirm-dialog";
import { PageHeader } from "@/shared/components/layout/page-header";

export const Route = createFileRoute("/_authenticated/margin-rules")({
	component: MarginRulesPage,
});

function MarginRulesPage() {
	const deleteRule = useDeleteMarginRule();
	const { data: rulesData } = useMarginRules();
	const rules = rulesData ?? [];

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<MarginRule | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<MarginRule | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const handleEdit = useCallback((rule: MarginRule) => {
		setEditTarget(rule);
	}, []);

	const handleDelete = useCallback((rule: MarginRule) => {
		setDeleteTarget(rule);
	}, []);

	const confirmDelete = useCallback(async () => {
		if (!deleteTarget) return;
		setIsDeleting(true);
		try {
			await deleteRule.mutateAsync(deleteTarget.id);
			setDeleteTarget(null);
		} finally {
			setIsDeleting(false);
		}
	}, [deleteTarget, deleteRule]);

	return (
		<div className="flex flex-col gap-6">
			<PageHeader
				title="Reglas de margen"
				description="Configura los márgenes de precio por rangos. Cada fila define el porcentaje de ganancia para cliente y distribuidor. Admin no usa reglas (siempre ve el precio de costo). Si dos rangos se solapan, la API rechaza con 409."
				actions={
					<Button onClick={() => setIsCreateOpen(true)}>
						<HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4" />
						Nueva regla
					</Button>
				}
			/>

			<MarginRuleList onEdit={handleEdit} onDelete={handleDelete} />

			<MarginRuleCreateDialog
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
				existingRules={rules}
			/>

			<MarginRuleEditDialog
				marginRule={editTarget}
				open={editTarget !== null}
				onOpenChange={(open) => !open && setEditTarget(null)}
				existingRules={rules}
			/>

			<ConfirmDialog
				isOpen={deleteTarget !== null}
				onClose={(open) => {
					if (!open) setDeleteTarget(null);
				}}
				onConfirm={confirmDelete}
				title="Eliminar regla de margen"
				description={`¿Estás seguro de eliminar la regla "${deleteTarget?.name ?? ""}"? Esta acción no se puede deshacer. Los productos sin regla usarán el margen por defecto (15% cliente, 10% distribuidor).`}
				confirmText="Eliminar"
				variant="destructive"
				isLoading={isDeleting}
			/>
		</div>
	);
}
