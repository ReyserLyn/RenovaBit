import { z } from "zod";

// ── Constants ────────────────────────────────────────────
// These MUST match the DB column lengths in `packages/db/src/schema/offers.ts`
// (varchar(100) for name/slug, text for description, numeric(12,2) for discount).
// The admin form's Zod validation is the first line of defense — it must not
// allow values that the API's TypeBox schema (or the DB) will reject.

export const OFFER_NAME_MAX = 100;
export const OFFER_SLUG_MAX = 100;
// The DB uses `text` (unbounded). The UI cap provides client-side validation
// and matches the maxLength enforced by the API.
export const OFFER_DESCRIPTION_MAX = 2000;

// ── Zod Schemas ──────────────────────────────────────────

// Form-level schema. All offers are percentage-based (0–100) and apply
// directly to products (no brands/categories). The dialog maps productIds
// to the API's `productIds` field on submit.
//
// Note: `startsAt`/`endsAt` are typed as `Date | undefined` because the shared
// DateTimePicker produces Date values. The dialog converts to ISO 8601 strings
// before calling the service, matching the API's `t.String({ format: "date-time" })`.
export const offerFormSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, { error: "El nombre es obligatorio" })
		.max(OFFER_NAME_MAX, {
			error: `El nombre no puede superar ${OFFER_NAME_MAX} caracteres`,
		}),
	slug: z
		.string()
		.trim()
		.max(OFFER_SLUG_MAX, {
			error: `El slug no puede superar ${OFFER_SLUG_MAX} caracteres`,
		})
		.optional(),
	description: z
		.string()
		.max(OFFER_DESCRIPTION_MAX, {
			error: `La descripción no puede superar ${OFFER_DESCRIPTION_MAX} caracteres`,
		})
		.optional(),
	// API requires minimum: 0.01 (no free offers), max: 100 (full price).
	discountValue: z
		.number()
		.min(0.01, { error: "El descuento debe ser mayor a 0" })
		.max(100, { error: "El descuento no puede superar el 100%" }),
	startsAt: z.date().optional(),
	endsAt: z.date().optional(),
	isActive: z.boolean().optional(),
	isFeatured: z.boolean().optional(),
	productIds: z.array(z.string()).optional(),
});

export type OfferFormValues = z.infer<typeof offerFormSchema>;
