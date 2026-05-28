import { z } from "zod";

// ── Constants ────────────────────────────────────────────

export const CATEGORY_NAME_MAX = 255;
export const CATEGORY_SLUG_MAX = 255;
export const CATEGORY_DESCRIPTION_MAX = 5000;
export const CATEGORY_IMAGE_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const CATEGORY_SEO_TITLE_MAX = 255;
export const CATEGORY_SEO_DESCRIPTION_MAX = 500;
export const CATEGORY_SEO_KEYWORDS_MAX = 500;

// ── Domain Types ────────────────────────────────────────

export interface Category {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	imageUrl: string | null;
	parentId: string | null;
	path: string | null;
	sortOrder: number | null;
	isFeatured: boolean;
	isActive: boolean;
	isVisibleInNav: boolean;
	seoTitle: string | null;
	seoDescription: string | null;
	seoKeywords: string | null;
	createdBy: string | null;
	updatedBy: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/** Nodo del árbol jerárquico devuelto por GET /tree */
export interface CategoryTreeNode {
	id: string;
	name: string;
	slug: string;
	imageUrl: string | null;
	description: string | null;
	sortOrder: number | null;
	isFeatured: boolean;
	isActive: boolean;
	isVisibleInNav: boolean;
	children: CategoryTreeNode[];
}

/** Item del breadcrumb devuelto por GET /breadcrumb/:slug */
export interface BreadcrumbItem {
	id: string;
	name: string;
	slug: string;
}

export interface CategoryBulkDeleteResult {
	deletedIds: string[];
	notFoundIds: string[];
	deletedCount: number;
}

// ── Zod Schemas ─────────────────────────────────────────

export const createCategorySchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, { error: "El nombre es obligatorio" })
		.max(CATEGORY_NAME_MAX, {
			error: `El nombre no puede superar ${CATEGORY_NAME_MAX} caracteres`,
		}),
	slug: z
		.string()
		.trim()
		.min(1, { error: "El slug es obligatorio" })
		.max(CATEGORY_SLUG_MAX, {
			error: `El slug no puede superar ${CATEGORY_SLUG_MAX} caracteres`,
		})
		.optional(),
	description: z
		.string()
		.max(CATEGORY_DESCRIPTION_MAX, {
			error: `La descripción no puede superar ${CATEGORY_DESCRIPTION_MAX} caracteres`,
		})
		.optional(),
	imageUrl: z
		.string()
		.max(2048, { error: "La URL de imagen no puede superar 2048 caracteres" })
		.optional(),
	parentId: z.uuid().nullable().optional(),
	sortOrder: z.number().int().min(0).optional(),
	isFeatured: z.boolean().optional(),
	isActive: z.boolean().optional(),
	isVisibleInNav: z.boolean().optional(),
	seoTitle: z
		.string()
		.max(CATEGORY_SEO_TITLE_MAX, {
			error: `El título SEO no puede superar ${CATEGORY_SEO_TITLE_MAX} caracteres`,
		})
		.optional(),
	seoDescription: z
		.string()
		.max(CATEGORY_SEO_DESCRIPTION_MAX, {
			error: `La descripción SEO no puede superar ${CATEGORY_SEO_DESCRIPTION_MAX} caracteres`,
		})
		.optional(),
	seoKeywords: z
		.string()
		.max(CATEGORY_SEO_KEYWORDS_MAX, {
			error: `Las palabras clave no pueden superar ${CATEGORY_SEO_KEYWORDS_MAX} caracteres`,
		})
		.optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const bulkDeleteSchema = z.object({
	ids: z
		.array(z.uuid())
		.min(1, { error: "Selecciona al menos una categoría" })
		.max(50, { error: "No puedes eliminar más de 50 categorías a la vez" }),
});

// ── Form Schemas ─────────────────────────────────────────

export const categoryFormSchema = z.object({
	name: createCategorySchema.shape.name,
	slug: z
		.string()
		.trim()
		.min(1, { error: "El slug es obligatorio" })
		.max(CATEGORY_SLUG_MAX, {
			error: `El slug no puede superar ${CATEGORY_SLUG_MAX} caracteres`,
		}),
	description: z.string().max(CATEGORY_DESCRIPTION_MAX, {
		error: `La descripción no puede superar ${CATEGORY_DESCRIPTION_MAX} caracteres`,
	}),
	parentId: z.uuid().nullable().optional(),
	sortOrder: z.number().int().min(0),
	isFeatured: z.boolean(),
	isActive: z.boolean(),
	isVisibleInNav: z.boolean(),
	seoTitle: z.string().max(CATEGORY_SEO_TITLE_MAX, {
		error: `El título SEO no puede superar ${CATEGORY_SEO_TITLE_MAX} caracteres`,
	}),
	seoDescription: z.string().max(CATEGORY_SEO_DESCRIPTION_MAX, {
		error: `La descripción SEO no puede superar ${CATEGORY_SEO_DESCRIPTION_MAX} caracteres`,
	}),
	seoKeywords: z.string().max(CATEGORY_SEO_KEYWORDS_MAX, {
		error: `Las palabras clave no pueden superar ${CATEGORY_SEO_KEYWORDS_MAX} caracteres`,
	}),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export type CreateCategoryValues = z.infer<typeof createCategorySchema>;
export type UpdateCategoryValues = z.infer<typeof updateCategorySchema>;
export type BulkDeleteValues = z.infer<typeof bulkDeleteSchema>;
