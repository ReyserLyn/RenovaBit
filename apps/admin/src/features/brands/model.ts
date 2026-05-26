import { z } from "zod";

// ── Constants ────────────────────────────────────────────
// SSOT: se usan tanto en los schemas como en los componentes del UI.

export const BRAND_SEO_TITLE_MAX = 255;
export const BRAND_SEO_DESCRIPTION_MAX = 500;
export const BRAND_SEO_KEYWORDS_MAX = 500;
export const BRAND_IMAGE_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// ── Domain Types ────────────────────────────────────────

export interface Brand {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	imageUrl: string | null;
	isActive: boolean;
	isFeatured: boolean;
	seoTitle: string | null;
	seoDescription: string | null;
	seoKeywords: string | null;
	createdBy: string | null;
	updatedBy: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface BrandBulkDeleteResult {
	deletedIds: string[];
	notFoundIds: string[];
	deletedCount: number;
}

// ── Zod Schemas ─────────────────────────────────────────

export const createBrandSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, { error: "El nombre es obligatorio" })
		.max(100, { error: "El nombre no puede superar 100 caracteres" }),
	slug: z
		.string()
		.trim()
		.min(1, { error: "El slug es obligatorio" })
		.max(100, { error: "El slug no puede superar 100 caracteres" })
		.optional(),
	description: z
		.string()
		.max(5000, { error: "La descripción no puede superar 5000 caracteres" })
		.optional(),
	imageUrl: z
		.string()
		.max(2048, { error: "La URL de imagen no puede superar 2048 caracteres" })
		.optional(),
	isActive: z.boolean().optional(),
	isFeatured: z.boolean().optional(),
	seoTitle: z
		.string()
		.max(BRAND_SEO_TITLE_MAX, {
			error: `El título SEO no puede superar ${BRAND_SEO_TITLE_MAX} caracteres`,
		})
		.optional(),
	seoDescription: z
		.string()
		.max(BRAND_SEO_DESCRIPTION_MAX, {
			error: `La descripción SEO no puede superar ${BRAND_SEO_DESCRIPTION_MAX} caracteres`,
		})
		.optional(),
	seoKeywords: z
		.string()
		.max(BRAND_SEO_KEYWORDS_MAX, {
			error: `Las palabras clave no pueden superar ${BRAND_SEO_KEYWORDS_MAX} caracteres`,
		})
		.optional(),
});

export const updateBrandSchema = createBrandSchema.partial();

export const bulkDeleteSchema = z.object({
	ids: z
		.array(z.string())
		.min(1, { error: "Selecciona al menos una marca" })
		.max(50, { error: "No puedes eliminar más de 50 marcas a la vez" }),
});

// ── Form Schemas ─────────────────────────────────────────

export const brandFormSchema = z.object({
	name: createBrandSchema.shape.name,
	slug: z
		.string()
		.trim()
		.min(1, { error: "El slug es obligatorio" })
		.max(100, { error: "El slug no puede superar 100 caracteres" }),
	description: z.string().max(5000, { error: "La descripción no puede superar 5000 caracteres" }),
	seoTitle: z.string().max(BRAND_SEO_TITLE_MAX, {
		error: `El título SEO no puede superar ${BRAND_SEO_TITLE_MAX} caracteres`,
	}),
	seoDescription: z.string().max(BRAND_SEO_DESCRIPTION_MAX, {
		error: `La descripción SEO no puede superar ${BRAND_SEO_DESCRIPTION_MAX} caracteres`,
	}),
	seoKeywords: z.string().max(BRAND_SEO_KEYWORDS_MAX, {
		error: `Las palabras clave no pueden superar ${BRAND_SEO_KEYWORDS_MAX} caracteres`,
	}),
	isActive: z.boolean(),
	isFeatured: z.boolean(),
});

export type BrandFormValues = z.infer<typeof brandFormSchema>;

export type CreateBrandValues = z.infer<typeof createBrandSchema>;
export type UpdateBrandValues = z.infer<typeof updateBrandSchema>;
export type BulkDeleteValues = z.infer<typeof bulkDeleteSchema>;
