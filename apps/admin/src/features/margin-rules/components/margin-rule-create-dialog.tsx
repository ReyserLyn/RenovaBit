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
import { useCreateMarginRule } from "../hooks";
import type { MarginRule } from "../service/margin-rules.service";
import type { MarginRuleFormValues } from "../validators";
import { ExistingRulesPanel, toRuleRangeRow } from "./existing-rules-panel";
import { MARGIN_RULE_FORM_ID, MarginRuleForm } from "./margin-rule-form";

// ── Props ────────────────────────────────────────────────

interface MarginRuleCreateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Existing rules to show as a visual reference. */
	existingRules: ReadonlyArray<MarginRule>;
}

// ── Component ────────────────────────────────────────────

export function MarginRuleCreateDialog({
	open,
	onOpenChange,
	existingRules,
}: MarginRuleCreateDialogProps) {
	const createRule = useCreateMarginRule();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleMutation = async (data: MarginRuleFormValues) => {
		await createRule.mutateAsync({
			name: data.name,
			minPrice: data.minPrice,
			maxPrice: data.maxPrice ?? null,
			customerPct: data.customerPct,
			distributorPct: data.distributorPct,
			sortOrder: data.sortOrder ?? 0,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-2xl p-0 gap-0 max-h-[85dvh] flex flex-col overflow-hidden"
				showCloseButton={false}
			>
				<DialogHeader className="shrink-0 p-4">
					<DialogTitle>Nueva regla de margen</DialogTitle>
					<DialogDescription>
						Crea una regla para definir el margen según el rango de precio, con un porcentaje por
						rol.
					</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
					<MarginRuleForm
						mode="create"
						defaultValues={{
							name: "",
							minPrice: 0,
							maxPrice: null,
							customerPct: 20,
							distributorPct: 10,
							sortOrder: 0,
						}}
						onMutation={handleMutation}
						onSuccess={() => onOpenChange(false)}
						onSubmittingChange={setIsSubmitting}
					>
						<ExistingRulesPanel
							title="Reglas existentes"
							description="Rangos ya definidos. Evita crear reglas que se solapen."
							rules={existingRules.map(toRuleRangeRow)}
						/>
					</MarginRuleForm>
				</div>

				<DialogFooter
					className="mx-0 mb-0 shrink-0 px-4 pb-4"
					showCloseButton
					closeLabel="Cancelar"
				>
					<Button type="submit" form={MARGIN_RULE_FORM_ID} disabled={isSubmitting}>
						{isSubmitting ? "Creando regla..." : "Crear regla"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
