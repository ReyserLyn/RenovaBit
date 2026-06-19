import { z } from "zod";

// ── Constants ────────────────────────────────────────────

// API caps name at 100 chars (apps/api/src/modules/products/margin-routes.ts).
export const MARGIN_RULE_NAME_MAX = 100;
export const MARGIN_PERCENT_MAX = 100;

// ── Zod Schemas ──────────────────────────────────────────

export const marginRuleFormSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, { error: "El nombre es obligatorio" })
		.max(MARGIN_RULE_NAME_MAX, {
			error: `El nombre no puede superar ${MARGIN_RULE_NAME_MAX} caracteres`,
		}),
	minPrice: z.number().min(0, { error: "El precio mínimo debe ser mayor o igual a 0" }),
	maxPrice: z.number().min(0).nullable().optional(),
	customerPct: z
		.number()
		.min(0, { error: "El porcentaje debe ser mayor o igual a 0" })
		.max(MARGIN_PERCENT_MAX, {
			error: `El porcentaje no puede superar ${MARGIN_PERCENT_MAX}%`,
		}),
	distributorPct: z
		.number()
		.min(0, { error: "El porcentaje debe ser mayor o igual a 0" })
		.max(MARGIN_PERCENT_MAX, {
			error: `El porcentaje no puede superar ${MARGIN_PERCENT_MAX}%`,
		}),
	sortOrder: z.number().int().min(0).optional(),
});

export type MarginRuleFormValues = z.infer<typeof marginRuleFormSchema>;
