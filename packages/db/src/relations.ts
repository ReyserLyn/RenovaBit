import { relations } from "drizzle-orm";
import { users } from "./schema/auth";
import { brands } from "./schema/brands";
import { cartItems, carts } from "./schema/cart";
import { categories } from "./schema/categories";
import { favoriteItems, favorites } from "./schema/favorites";
import { offerBrands, offerCategories, offerProducts, offers } from "./schema/offers";
import { orderItems, orders } from "./schema/orders";
import { productImages, products } from "./schema/products";
import { productProviders } from "./schema/providers";
import { scrapingBlacklist } from "./schema/scraping-blacklist";
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
	cartItems: many(cartItems),
	orderItems: many(orderItems),
	offerProducts: many(offerProducts),
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

// ── Scraping Blacklist ─────────────────────────────

export const scrapingBlacklistRelations = relations(scrapingBlacklist, ({ one }) => ({
	createdByUser: one(users, {
		fields: [scrapingBlacklist.createdBy],
		references: [users.id],
	}),
}));

// ── Offers ──────────────────────────────────────────

export const offersRelations = relations(offers, ({ one, many }) => ({
	createdByUser: one(users, {
		fields: [offers.createdBy],
		references: [users.id],
	}),
	offerProducts: many(offerProducts),
	offerBrands: many(offerBrands),
	offerCategories: many(offerCategories),
}));

export const offerProductsRelations = relations(offerProducts, ({ one }) => ({
	offer: one(offers, {
		fields: [offerProducts.offerId],
		references: [offers.id],
	}),
	product: one(products, {
		fields: [offerProducts.productId],
		references: [products.id],
	}),
}));

export const offerBrandsRelations = relations(offerBrands, ({ one }) => ({
	offer: one(offers, {
		fields: [offerBrands.offerId],
		references: [offers.id],
	}),
	brand: one(brands, {
		fields: [offerBrands.brandId],
		references: [brands.id],
	}),
}));

export const offerCategoriesRelations = relations(offerCategories, ({ one }) => ({
	offer: one(offers, {
		fields: [offerCategories.offerId],
		references: [offers.id],
	}),
	category: one(categories, {
		fields: [offerCategories.categoryId],
		references: [categories.id],
	}),
}));

// ── Admin Notifications ─────────────────────────────

export const adminNotificationsRelations = relations(adminNotifications, ({ one }) => ({
	user: one(users, {
		fields: [adminNotifications.userId],
		references: [users.id],
	}),
}));

// ── Carts ─────────────────────────────────────────────

export const cartsRelations = relations(carts, ({ many, one }) => ({
	user: one(users, {
		fields: [carts.userId],
		references: [users.id],
	}),
	items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
	cart: one(carts, {
		fields: [cartItems.cartId],
		references: [carts.id],
	}),
	product: one(products, {
		fields: [cartItems.productId],
		references: [products.id],
	}),
}));

// ── Orders ────────────────────────────────────────────

export const ordersRelations = relations(orders, ({ many, one }) => ({
	user: one(users, {
		fields: [orders.userId],
		references: [users.id],
	}),
	items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id],
	}),
	product: one(products, {
		fields: [orderItems.productId],
		references: [products.id],
	}),
}));

// ── Favorites ─────────────────────────────────────────

export const favoritesRelations = relations(favorites, ({ many, one }) => ({
	user: one(users, {
		fields: [favorites.userId],
		references: [users.id],
	}),
	items: many(favoriteItems),
}));

export const favoriteItemsRelations = relations(favoriteItems, ({ one }) => ({
	favorite: one(favorites, {
		fields: [favoriteItems.favoriteId],
		references: [favorites.id],
	}),
	product: one(products, {
		fields: [favoriteItems.productId],
		references: [products.id],
	}),
}));
