import { relations } from "drizzle-orm";
import { brands } from "./schema/brands";
import { categories } from "./schema/categories";
import { productImages, products } from "./schema/products";

// ── Brands ───────────────────────────────────────────

export const brandsRelations = relations(brands, ({ many }) => ({
	products: many(products),
}));

// ── Categories ───────────────────────────────────────

export const categoriesRelations = relations(categories, ({ many, one }) => ({
	products: many(products),
	parent: one(categories, {
		fields: [categories.parentId],
		references: [categories.id],
		relationName: "category_parent",
	}),
	children: many(categories, { relationName: "category_parent" }),
}));

// ── Products ─────────────────────────────────────────

export const productsRelations = relations(products, ({ one, many }) => ({
	brand: one(brands, {
		fields: [products.brandId],
		references: [brands.id],
	}),
	category: one(categories, {
		fields: [products.categoryId],
		references: [categories.id],
	}),
	images: many(productImages),
}));

// ── Product Images ───────────────────────────────────

export const productImagesRelations = relations(productImages, ({ one }) => ({
	product: one(products, {
		fields: [productImages.productId],
		references: [products.id],
	}),
}));
