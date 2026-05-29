import { relations } from "drizzle-orm";
import { users } from "./schema/auth";
import { brands } from "./schema/brands";
import { categories } from "./schema/categories";
import { productImages, products } from "./schema/products";
import { productProviders } from "./schema/providers";
import { adminNotifications, productChanges, syncReports } from "./schema/sync";

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
	providers: many(productProviders),
	changes: many(productChanges),
}));

// ── Product Images ───────────────────────────────────

export const productImagesRelations = relations(productImages, ({ one }) => ({
	product: one(products, {
		fields: [productImages.productId],
		references: [products.id],
	}),
}));

// ── Product Providers ───────────────────────────────

export const productProvidersRelations = relations(productProviders, ({ one }) => ({
	product: one(products, {
		fields: [productProviders.productId],
		references: [products.id],
	}),
}));

// ── Sync Reports ────────────────────────────────────

export const syncReportsRelations = relations(syncReports, ({ many }) => ({
	changes: many(productChanges),
}));

// ── Product Changes ─────────────────────────────────

export const productChangesRelations = relations(productChanges, ({ one }) => ({
	product: one(products, {
		fields: [productChanges.productId],
		references: [products.id],
	}),
	report: one(syncReports, {
		fields: [productChanges.syncReportId],
		references: [syncReports.id],
	}),
	user: one(users, {
		fields: [productChanges.userId],
		references: [users.id],
	}),
}));

// ── Admin Notifications ─────────────────────────────

export const adminNotificationsRelations = relations(adminNotifications, ({ one }) => ({
	user: one(users, {
		fields: [adminNotifications.userId],
		references: [users.id],
	}),
}));
