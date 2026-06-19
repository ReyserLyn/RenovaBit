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
import { useUpdateMarginRule } from "../hooks";
import type { MarginRule } from "../service/margin-rules.service";
import type { MarginRuleFormValues } from "../validators";
import { ExistingRulesPanel, toRuleRangeRow } from "./existing-rules-panel";
import { MARGIN_RULE_FORM_ID, MarginRuleForm } from "./margin-rule-form";

// ── Props ────────────────────────────────────────────────

interface MarginRuleEditDialogProps {
	marginRule: MarginRule | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	existingRules: ReadonlyArray<MarginRule>;
}

// ── Component ────────────────────────────────────────────

export function MarginRuleEditDialog({
	marginRule,
	open,
	onOpenChange,
	existingRules,
}: MarginRuleEditDialogProps) {
	const updateRule = useUpdateMarginRule();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleMutation = async (data: MarginRuleFormValues) => {
		if (!marginRule) return;
		await updateRule.mutateAsync({
			id: marginRule.id,
			data: {
				name: data.name,
				minPrice: data.minPrice,
				maxPrice: data.maxPrice ?? null,
				customerPct: data.customerPct,
				distributorPct: data.distributorPct,
				sortOrder: data.sortOrder ?? 0,
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
					<DialogTitle>Editar: {marginRule?.name ?? ""}</DialogTitle>
					<DialogDescription>Actualiza los datos de la regla de margen.</DialogDescription>
				</DialogHeader>

				{marginRule ? (
					<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
						<MarginRuleForm
							key={marginRule.id}
							mode="edit"
							marginRule={marginRule}
							onMutation={handleMutation}
							onSuccess={() => onOpenChange(false)}
							onSubmittingChange={setIsSubmitting}
						>
							<ExistingRulesPanel
								title="Reglas existentes"
								description="Rangos ya definidos. Evita crear reglas que se solapen."
								rules={existingRules.map(toRuleRangeRow)}
								highlightId={marginRule.id}
							/>
						</MarginRuleForm>
					</div>
				) : null}

				<DialogFooter
					className="mx-0 mb-0 shrink-0 px-4 pb-4"
					showCloseButton
					closeLabel="Cancelar"
				>
					<Button type="submit" form={MARGIN_RULE_FORM_ID} disabled={isSubmitting || !marginRule}>
						{isSubmitting ? "Guardando..." : "Guardar cambios"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
