import { z } from "zod";

// ── Constants ────────────────────────────────────────────

export const PRODUCT_NAME_MAX = 255;
export const PRODUCT_SLUG_MAX = 255;
export const PRODUCT_DESCRIPTION_MAX = 10000;
export const PRODUCT_SKU_MAX = 100;
export const PRODUCT_SPECS_MAX = 50;
export const PRODUCT_IMAGES_MAX = 10;
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const PRODUCT_SEO_TITLE_MAX = 255;
export const PRODUCT_SEO_DESCRIPTION_MAX = 500;
export const PRODUCT_SEO_KEYWORDS_MAX = 500;

// ── Domain Types ─────────────────────────────────────────

export interface Product {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	sku: string;
	price: string;
	stock: number;
	brandId: string | null;
	categoryId: string | null;
	specifications: ProductSpecification[] | null;
	isActive: boolean;
	isFeatured: boolean;
	imageUrls?: string[];
	imageCount?: number;
	seoTitle: string | null;
	seoDescription: string | null;
	seoKeywords: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface ProductSpecification {
	id: string;
	key: string;
	value: string;
}

export interface ProductImage {
	id: string;
	productId: string;
	url: string;
	alt: string | null;
	sortOrder: number | null;
	isPrimary: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface ProductBulkDeleteResult {
	deletedIds: string[];
	notFoundIds: string[];
	deletedCount: number;
}

// ── Zod Schemas ──────────────────────────────────────────

export const createProductSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, { message: "El nombre es obligatorio" })
		.max(PRODUCT_NAME_MAX, {
			message: `El nombre no puede superar ${PRODUCT_NAME_MAX} caracteres`,
		}),
	slug: z
		.string()
		.trim()
		.min(1, { message: "El slug es obligatorio" })
		.max(PRODUCT_SLUG_MAX, {
			message: `El slug no puede superar ${PRODUCT_SLUG_MAX} caracteres`,
		})
		.optional(),
	description: z
		.string()
		.max(PRODUCT_DESCRIPTION_MAX, {
			message: `La descripción no puede superar ${PRODUCT_DESCRIPTION_MAX} caracteres`,
		})
		.optional(),
	sku: z
		.string()
		.trim()
		.min(1, { message: "El SKU es obligatorio" })
		.max(PRODUCT_SKU_MAX, {
			message: `El SKU no puede superar ${PRODUCT_SKU_MAX} caracteres`,
		}),
	price: z.string().min(1, { message: "El precio es obligatorio" }),
	stock: z.number().int().min(0).optional(),
	brandId: z.uuid().nullable().optional(),
	categoryId: z.uuid().nullable().optional(),
	specifications: z
		.array(
			z.object({
				id: z.string(),
				key: z.string().min(1, { message: "La clave es obligatoria" }),
				value: z.string().min(1, { message: "El valor es obligatorio" }),
			}),
		)
		.max(PRODUCT_SPECS_MAX)
		.optional(),
	isActive: z.boolean().optional(),
	isFeatured: z.boolean().optional(),
	seoTitle: z
		.string()
		.max(PRODUCT_SEO_TITLE_MAX, {
			message: `El título SEO no puede superar ${PRODUCT_SEO_TITLE_MAX} caracteres`,
		})
		.optional(),
	seoDescription: z
		.string()
		.max(PRODUCT_SEO_DESCRIPTION_MAX, {
			message: `La descripción SEO no puede superar ${PRODUCT_SEO_DESCRIPTION_MAX} caracteres`,
		})
		.optional(),
	seoKeywords: z
		.string()
		.max(PRODUCT_SEO_KEYWORDS_MAX, {
			message: `Las palabras clave no pueden superar ${PRODUCT_SEO_KEYWORDS_MAX} caracteres`,
		})
		.optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const bulkDeleteSchema = z.object({
	ids: z
		.array(z.string())
		.min(1, { message: "Selecciona al menos un producto" })
		.max(50, { message: "No puedes eliminar más de 50 productos a la vez" }),
});

// ── Form Schemas ─────────────────────────────────────────

export const productFormSchema = z.object({
	name: createProductSchema.shape.name,
	slug: z
		.string()
		.trim()
		.min(1, { message: "El slug es obligatorio" })
		.max(PRODUCT_SLUG_MAX, {
			message: `El slug no puede superar ${PRODUCT_SLUG_MAX} caracteres`,
		}),
	description: z.string().max(PRODUCT_DESCRIPTION_MAX, {
		message: `La descripción no puede superar ${PRODUCT_DESCRIPTION_MAX} caracteres`,
	}),
	sku: z
		.string()
		.trim()
		.min(1, { message: "El SKU es obligatorio" })
		.max(PRODUCT_SKU_MAX, {
			message: `El SKU no puede superar ${PRODUCT_SKU_MAX} caracteres`,
		}),
	price: z
		.string()
		.min(1, { message: "El precio es obligatorio" })
		.regex(/^\d+(\.\d{1,2})?$/, { message: "El precio debe ser un número válido (ej: 99.99)" }),
	stock: z.number().int().min(0, { message: "El stock no puede ser negativo" }),
	brandId: z.uuid().nullable().optional(),
	categoryId: z.uuid().nullable().optional(),
	specifications: z
		.array(
			z.object({
				id: z.string(),
				key: z.string().min(1, { message: "La clave es obligatoria" }),
				value: z.string().min(1, { message: "El valor es obligatorio" }),
			}),
		)
		.max(PRODUCT_SPECS_MAX),
	isActive: z.boolean(),
	isFeatured: z.boolean(),
	seoTitle: z.string().max(PRODUCT_SEO_TITLE_MAX, {
		message: `El título SEO no puede superar ${PRODUCT_SEO_TITLE_MAX} caracteres`,
	}),
	seoDescription: z.string().max(PRODUCT_SEO_DESCRIPTION_MAX, {
		message: `La descripción SEO no puede superar ${PRODUCT_SEO_DESCRIPTION_MAX} caracteres`,
	}),
	seoKeywords: z.string().max(PRODUCT_SEO_KEYWORDS_MAX, {
		message: `Las palabras clave no pueden superar ${PRODUCT_SEO_KEYWORDS_MAX} caracteres`,
	}),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
export type CreateProductValues = z.infer<typeof createProductSchema>;
export type UpdateProductValues = z.infer<typeof updateProductSchema>;
export type BulkDeleteValues = z.infer<typeof bulkDeleteSchema>;
