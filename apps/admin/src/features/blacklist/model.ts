import { z } from "zod";

// ── Constants ────────────────────────────────────────────

export const BLACKLIST_EXTERNAL_ID_MAX = 255;
export const BLACKLIST_SOURCE_MAX = 100;
export const BLACKLIST_REASON_MAX = 500;

// ── Domain Types ────────────────────────────────────────

export interface BlacklistEntry {
	id: string;
	source: string;
	externalId: string;
	productName: string | null;
	reason: string | null;
	createdBy: string | null;
	createdAt: Date;
	updatedAt: Date;
}

// ── Zod Schemas ─────────────────────────────────────────

export const addBlacklistSchema = z.object({
	externalId: z
		.string()
		.trim()
		.min(1, { error: "El ID externo es obligatorio" })
		.max(BLACKLIST_EXTERNAL_ID_MAX, {
			error: `El ID externo no puede superar ${BLACKLIST_EXTERNAL_ID_MAX} caracteres`,
		}),
	source: z
		.string()
		.trim()
		.max(BLACKLIST_SOURCE_MAX, {
			error: `El source no puede superar ${BLACKLIST_SOURCE_MAX} caracteres`,
		})
		.optional(),
	reason: z
		.string()
		.trim()
		.max(BLACKLIST_REASON_MAX, {
			error: `El motivo no puede superar ${BLACKLIST_REASON_MAX} caracteres`,
		})
		.optional(),
	productName: z
		.string()
		.trim()
		.max(255, {
			error: "El nombre del producto no puede superar 255 caracteres",
		})
		.optional(),
});

export const removeBlacklistSchema = z.object({
	externalId: z.string().trim().min(1, { error: "El ID externo es obligatorio" }),
	source: z.string().trim().optional(),
});

export const blacklistFormSchema = z.object({
	externalId: z
		.string()
		.trim()
		.max(BLACKLIST_EXTERNAL_ID_MAX, {
			error: `El ID externo no puede superar ${BLACKLIST_EXTERNAL_ID_MAX} caracteres`,
		}),
	reason: z
		.string()
		.trim()
		.max(BLACKLIST_REASON_MAX, {
			error: `El motivo no puede superar ${BLACKLIST_REASON_MAX} caracteres`,
		}),
});

export type BlacklistFormValues = z.infer<typeof blacklistFormSchema>;
export type AddBlacklistValues = z.infer<typeof addBlacklistSchema>;
export type RemoveBlacklistValues = z.infer<typeof removeBlacklistSchema>;
