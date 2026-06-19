/**
 * Offer service — DB operations, business logic, and shared SQL fragments.
 */
import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import {
	brands,
	categories,
	offerBrands,
	offerCategories,
	offerProducts,
	offers,
	products,
} from "@renovabit/db/schema";
import type { OfferInput } from "@renovabit/pricing";
import { and, desc, eq, getTableColumns, gte, ilike, inArray, lte, sql } from "drizzle-orm";
import { handleUniqueViolation, makeSlug } from "@/utils/db-helpers";
import type { CreateOfferDto, UpdateOfferDto } from "./model";

// ── Helpers ─────────────────────────────────────────

function assertDateRange(startsAt: string | Date, endsAt: string | Date): void {
	if (new Date(endsAt) <= new Date(startsAt)) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "La fecha de fin debe ser posterior a la fecha de inicio",
			logLevel: "info",
			doNotLog: true,
		});
	}
}

// ── Shared SQL fragments ────────────────────────────

/**
 * Shape of an active offer reference attached to a product response.
 * Kept in sync with `PublicOfferRef` in `./model.ts` (the TypeBox schema
 * for the HTTP response) and the `OfferInfo` type in the admin client.
 */
export type ActiveOfferRef = {
	id: string;
	name: string;
	slug: string;
	discountType: "percentage" | "fixed_amount";
	discountValue: string;
	isFeatured: boolean;
};

/**
 * SQL fragment that aggregates all active offers applicable to a single
 * product row, as a `jsonb_agg` subquery returning `ActiveOfferRef[]`.
 *
 * An offer applies to a product if:
 *   - `is_active = true` AND `starts_at <= NOW()` AND `ends_at >= NOW()`, AND
 *   - (
 *     (type = 'product'  AND there's an `offer_products` row matching), OR
 *     (type = 'brand'    AND the product has a brand AND there's an `offer_brands` row matching), OR
 *     (type = 'category' AND the product has a category AND there's an `offer_categories` row matching)
 *   )
 *
 * Must be used inside a `db.select().from(products)` context so the
 * `products.id`, `products.brandId`, `products.categoryId` column refs resolve.
 */
export function activeOffersForProductSubquery() {
	return sql<ActiveOfferRef[]>`COALESCE(
		(
			SELECT jsonb_agg(jsonb_build_object(
				'id', o.id,
				'name', o.name,
				'slug', o.slug,
				'discountType', o.discount_type,
				'discountValue', o.discount_value::text,
				'isFeatured', o.is_featured
			))
			FROM offers o
			WHERE o.is_active = true
				AND o.starts_at <= NOW()
				AND o.ends_at >= NOW()
				AND (
					(o.type = 'product' AND EXISTS (SELECT 1 FROM offer_products op WHERE op.offer_id = o.id AND op.product_id = ${products.id}))
					OR (o.type = 'brand' AND ${products.brandId} IS NOT NULL AND EXISTS (SELECT 1 FROM offer_brands ob WHERE ob.offer_id = o.id AND ob.brand_id = ${products.brandId}))
					OR (o.type = 'category' AND ${products.categoryId} IS NOT NULL AND EXISTS (SELECT 1 FROM offer_categories oc WHERE oc.offer_id = o.id AND oc.category_id = ${products.categoryId}))
				)
		),
		'[]'::jsonb
	)`;
}

// ── FK validation ──────────────────────────────────

async function ensureProductsExist(productIds: string[]): Promise<void> {
	if (productIds.length === 0) return;
	const rows = await db
		.select({ id: products.id })
		.from(products)
		.where(inArray(products.id, productIds));
	if (rows.length !== productIds.length) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Uno o más productos no existen",
			logLevel: "info",
			doNotLog: true,
		});
	}
}

async function ensureBrandsExist(brandIds: string[]): Promise<void> {
	if (brandIds.length === 0) return;
	const rows = await db.select({ id: brands.id }).from(brands).where(inArray(brands.id, brandIds));
	if (rows.length !== brandIds.length) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Uno o más marcas no existen",
			logLevel: "info",
			doNotLog: true,
		});
	}
}

async function ensureCategoriesExist(categoryIds: string[]): Promise<void> {
	if (categoryIds.length === 0) return;
	const rows = await db
		.select({ id: categories.id })
		.from(categories)
		.where(inArray(categories.id, categoryIds));
	if (rows.length !== categoryIds.length) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Uno o más categorías no existen",
			logLevel: "info",
			doNotLog: true,
		});
	}
}

// ── List ────────────────────────────────────────────

async function list(options: {
	search?: string;
	isActive?: string;
	isFeatured?: string;
	from?: string;
	to?: string;
}) {
	const conditions: ReturnType<typeof and>[] = [];

	if (options.search) {
		conditions.push(ilike(offers.name, `%${options.search}%`));
	}
	if (options.isActive === "true") {
		conditions.push(eq(offers.isActive, true));
	} else if (options.isActive === "false") {
		conditions.push(eq(offers.isActive, false));
	}
	if (options.isFeatured === "true") {
		conditions.push(eq(offers.isFeatured, true));
	} else if (options.isFeatured === "false") {
		conditions.push(eq(offers.isFeatured, false));
	}
	if (options.from) {
		const fromDate = new Date(options.from);
		if (!Number.isNaN(fromDate.getTime())) {
			conditions.push(gte(offers.createdAt, fromDate));
		}
	}
	if (options.to) {
		const toDate = new Date(options.to);
		if (!Number.isNaN(toDate.getTime())) {
			if (
				toDate.getUTCHours() === 0 &&
				toDate.getUTCMinutes() === 0 &&
				toDate.getUTCSeconds() === 0
			) {
				toDate.setHours(23, 59, 59, 999);
			}
			conditions.push(lte(offers.createdAt, toDate));
		}
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	return db
		.select({
			...getTableColumns(offers),
			discountValue: sql<string>`${offers.discountValue}::text`,
			productCount: sql<number>`(
				SELECT COUNT(*)::int FROM offer_products op WHERE op.offer_id = offers.id
			)`,
			brandCount: sql<number>`(
				SELECT COUNT(*)::int FROM offer_brands ob WHERE ob.offer_id = offers.id
			)`,
			categoryCount: sql<number>`(
				SELECT COUNT(*)::int FROM offer_categories oc WHERE oc.offer_id = offers.id
			)`,
		})
		.from(offers)
		.where(where)
		.orderBy(desc(offers.createdAt));
}

// ── Get by ID ───────────────────────────────────────

async function getById(id: string) {
	const [row] = await db.select().from(offers).where(eq(offers.id, id)).limit(1);

	return row ?? null;
}

async function getByIdStrict(id: string) {
	const row = await getById(id);
	if (!row) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Oferta no encontrada",
			logLevel: "info",
			doNotLog: true,
		});
	}
	return row;
}

// ── Get by slug ─────────────────────────────────────

async function getBySlug(slug: string) {
	const [row] = await db.select().from(offers).where(eq(offers.slug, slug)).limit(1);

	return row ?? null;
}

// ── Create ──────────────────────────────────────────

async function create(data: CreateOfferDto, userId: string) {
	const nextSlug = data.slug?.trim() ? makeSlug(data.slug) : makeSlug(data.name);

	if (!nextSlug) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "El slug de la oferta no puede estar vacío",
			logLevel: "info",
			doNotLog: true,
		});
	}

	const offerType = data.type ?? "product";

	// ── Date validation ──
	assertDateRange(data.startsAt, data.endsAt);

	// ── FK validation ──
	if (offerType === "product" && data.productIds?.length) {
		await ensureProductsExist(data.productIds);
	}
	if (offerType === "brand" && data.brandIds?.length) {
		await ensureBrandsExist(data.brandIds);
	}
	if (offerType === "category" && data.categoryIds?.length) {
		await ensureCategoriesExist(data.categoryIds);
	}

	const row = await db.transaction(async (tx) => {
		const [inserted] = await tx
			.insert(offers)
			.values({
				name: data.name,
				slug: nextSlug,
				description: data.description ?? null,
				type: offerType,
				discountType: data.discountType,
				discountValue: String(data.discountValue),
				startsAt: new Date(data.startsAt),
				endsAt: new Date(data.endsAt),
				isActive: data.isActive ?? true,
				isFeatured: data.isFeatured ?? false,
				createdBy: userId || null,
			})
			.returning()
			.catch((err) => handleUniqueViolation(err, "Ya existe una oferta con este slug"));

		if (!inserted) {
			throw createApiError({
				code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
				message: "Error al crear la oferta",
			});
		}

		// Insert product assignments
		if (offerType === "product" && data.productIds?.length) {
			const values = data.productIds.map((productId) => {
				const override = data.overrides?.[productId];
				return {
					offerId: inserted.id,
					productId,
					overrideDiscountType: override?.overrideDiscountType ?? null,
					overrideDiscountValue:
						override?.overrideDiscountValue != null ? String(override.overrideDiscountValue) : null,
				};
			});

			await tx.insert(offerProducts).values(values);
		}

		// Insert brand assignments
		if (offerType === "brand" && data.brandIds?.length) {
			await tx.insert(offerBrands).values(
				data.brandIds.map((brandId) => ({
					offerId: inserted.id,
					brandId,
				})),
			);
		}

		// Insert category assignments
		if (offerType === "category" && data.categoryIds?.length) {
			await tx.insert(offerCategories).values(
				data.categoryIds.map((categoryId) => ({
					offerId: inserted.id,
					categoryId,
				})),
			);
		}

		return inserted;
	});

	return row;
}

// ── Update ──────────────────────────────────────────

async function update(id: string, data: UpdateOfferDto, userId: string) {
	const current = await getByIdStrict(id);

	// ── Date validation (only when both dates are provided) ──
	if (data.startsAt !== undefined && data.endsAt !== undefined) {
		assertDateRange(data.startsAt, data.endsAt);
	}

	// ── FK validation (before junction replacement) ──
	if (data.productIds !== undefined && data.productIds.length > 0) {
		await ensureProductsExist(data.productIds);
	}
	if (data.brandIds !== undefined && data.brandIds.length > 0) {
		await ensureBrandsExist(data.brandIds);
	}
	if (data.categoryIds !== undefined && data.categoryIds.length > 0) {
		await ensureCategoriesExist(data.categoryIds);
	}

	return db.transaction(async (tx) => {
		const updateData: Partial<typeof offers.$inferInsert> = {};

		if (data.name !== undefined) updateData.name = data.name;
		if (data.description !== undefined) updateData.description = data.description;
		if (data.type !== undefined) updateData.type = data.type;
		if (data.discountType !== undefined) updateData.discountType = data.discountType;
		if (data.discountValue !== undefined) updateData.discountValue = String(data.discountValue);
		if (data.startsAt !== undefined) updateData.startsAt = new Date(data.startsAt);
		if (data.endsAt !== undefined) updateData.endsAt = new Date(data.endsAt);
		if (data.isActive !== undefined) updateData.isActive = data.isActive;
		if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;

		if (data.slug !== undefined) {
			const nextSlug = makeSlug(data.slug);
			if (!nextSlug) {
				throw createApiError({
					code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
					message: "El slug de la oferta no puede estar vacío",
					logLevel: "info",
					doNotLog: true,
				});
			}
			updateData.slug = nextSlug;
		}

		const hasMainUpdates = Object.keys(updateData).length > 0;

		let updatedRow: typeof offers.$inferSelect | undefined;
		if (hasMainUpdates) {
			const [row] = await tx
				.update(offers)
				.set(updateData)
				.where(eq(offers.id, id))
				.returning()
				.catch((err) => handleUniqueViolation(err, "Ya existe una oferta con este slug"));

			if (!row) {
				throw createApiError({
					code: BackendErrorCodes.NOT_FOUND_ERROR,
					message: "Oferta no encontrada",
					logLevel: "info",
					doNotLog: true,
				});
			}
			updatedRow = row;
		} else {
			updatedRow = current;
		}

		// Clean up old junction rows when type changes
		if (data.type !== undefined && data.type !== current.type) {
			if (current.type === "product") {
				await tx.delete(offerProducts).where(eq(offerProducts.offerId, id));
			}
			if (current.type === "brand") {
				await tx.delete(offerBrands).where(eq(offerBrands.offerId, id));
			}
			if (current.type === "category") {
				await tx.delete(offerCategories).where(eq(offerCategories.offerId, id));
			}
		}

		// Update product assignments if provided
		if (data.productIds !== undefined) {
			await tx.delete(offerProducts).where(eq(offerProducts.offerId, id));

			if (data.productIds.length > 0) {
				const values = data.productIds.map((productId) => ({
					offerId: id,
					productId,
				}));
				await tx.insert(offerProducts).values(values);
			}
		}

		// Update brand assignments if provided
		if (data.brandIds !== undefined) {
			await tx.delete(offerBrands).where(eq(offerBrands.offerId, id));

			if (data.brandIds.length > 0) {
				await tx.insert(offerBrands).values(
					data.brandIds.map((brandId) => ({
						offerId: id,
						brandId,
					})),
				);
			}
		}

		// Update category assignments if provided
		if (data.categoryIds !== undefined) {
			await tx.delete(offerCategories).where(eq(offerCategories.offerId, id));

			if (data.categoryIds.length > 0) {
				await tx.insert(offerCategories).values(
					data.categoryIds.map((categoryId) => ({
						offerId: id,
						categoryId,
					})),
				);
			}
		}

		return updatedRow;
	});
}

// ── Delete (soft: set isActive=false) ────────────────

async function deleteById(id: string) {
	const [row] = await db
		.update(offers)
		.set({ isActive: false })
		.where(eq(offers.id, id))
		.returning();

	if (!row) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Oferta no encontrada",
			logLevel: "info",
			doNotLog: true,
		});
	}

	return row;
}

// ── Assign products (admin) ─────────────────────────

async function assignProducts(
	offerId: string,
	productIds: string[],
	overrides?: Record<
		string,
		{ overrideDiscountType?: "percentage" | "fixed_amount"; overrideDiscountValue?: number }
	>,
) {
	await getByIdStrict(offerId);

	if (productIds.length > 0) {
		await ensureProductsExist(productIds);
	}

	// Remove existing assignments
	await db.delete(offerProducts).where(eq(offerProducts.offerId, offerId));

	// Insert new ones
	if (productIds.length > 0) {
		const values = productIds.map((productId) => {
			const override = overrides?.[productId];
			return {
				offerId,
				productId,
				overrideDiscountType: override?.overrideDiscountType ?? null,
				overrideDiscountValue:
					override?.overrideDiscountValue != null ? String(override.overrideDiscountValue) : null,
			};
		});

		await db.insert(offerProducts).values(values);
	}

	return { offerId, assignedCount: productIds.length };
}

// ── Get products for an offer (public) ──────────────

async function getProducts(offerId: string) {
	return db
		.select({ productId: offerProducts.productId })
		.from(offerProducts)
		.where(eq(offerProducts.offerId, offerId));
}

// ── Get brands for an offer (public) ────────────────

async function getBrands(offerId: string) {
	return db
		.select({ brandId: offerBrands.brandId })
		.from(offerBrands)
		.where(eq(offerBrands.offerId, offerId));
}

// ── Get categories for an offer (public) ────────────

async function getCategories(offerId: string) {
	return db
		.select({ categoryId: offerCategories.categoryId })
		.from(offerCategories)
		.where(eq(offerCategories.offerId, offerId));
}

// ── Assign brands (admin) ───────────────────────────

async function assignBrands(offerId: string, brandIds: string[]) {
	await getByIdStrict(offerId);

	if (brandIds.length > 0) {
		await ensureBrandsExist(brandIds);
	}

	await db.delete(offerBrands).where(eq(offerBrands.offerId, offerId));

	if (brandIds.length > 0) {
		await db.insert(offerBrands).values(
			brandIds.map((brandId) => ({
				offerId,
				brandId,
			})),
		);
	}

	return { offerId, assignedCount: brandIds.length };
}

// ── Assign categories (admin) ───────────────────────

async function assignCategories(offerId: string, categoryIds: string[]) {
	await getByIdStrict(offerId);

	if (categoryIds.length > 0) {
		await ensureCategoriesExist(categoryIds);
	}

	await db.delete(offerCategories).where(eq(offerCategories.offerId, offerId));

	if (categoryIds.length > 0) {
		await db.insert(offerCategories).values(
			categoryIds.map((categoryId) => ({
				offerId,
				categoryId,
			})),
		);
	}

	return { offerId, assignedCount: categoryIds.length };
}

// ── Active offers (public) ──────────────────────────

async function getActive() {
	const now = new Date();

	const rows = await db
		.select({
			id: offers.id,
			name: offers.name,
			slug: offers.slug,
			description: offers.description,
			type: offers.type,
			discountType: offers.discountType,
			discountValue: sql<string>`${offers.discountValue}::text`,
			// COALESCE because `isFeatured` is nullable in the Drizzle schema
			// (default false but no .notNull()). The public API guarantees boolean.
			isFeatured: sql<boolean>`COALESCE(${offers.isFeatured}, false)`,
			startsAt: offers.startsAt,
			endsAt: offers.endsAt,
			productCount: sql<number>`(
				SELECT COUNT(*)::int FROM offer_products op WHERE op.offer_id = offers.id
			)`,
			brandCount: sql<number>`(
				SELECT COUNT(*)::int FROM offer_brands ob WHERE ob.offer_id = offers.id
			)`,
			categoryCount: sql<number>`(
				SELECT COUNT(*)::int FROM offer_categories oc WHERE oc.offer_id = offers.id
			)`,
		})
		.from(offers)
		.where(
			and(
				eq(offers.isActive, true),
				lte(offers.startsAt, now),
				gte(offers.endsAt, now), // Note: gte for endsAt means still active
			),
		)
		.orderBy(desc(offers.createdAt));

	return rows;
}

// ── Get active by slug (public) ─────────────────────

async function getActiveBySlug(slug: string) {
	const now = new Date();

	const [row] = await db
		.select({
			id: offers.id,
			name: offers.name,
			slug: offers.slug,
			description: offers.description,
			type: offers.type,
			discountType: offers.discountType,
			discountValue: sql<string>`${offers.discountValue}::text`,
			isFeatured: sql<boolean>`COALESCE(${offers.isFeatured}, false)`,
			startsAt: offers.startsAt,
			endsAt: offers.endsAt,
		})
		.from(offers)
		.where(
			and(
				eq(offers.slug, slug),
				eq(offers.isActive, true),
				lte(offers.startsAt, now),
				gte(offers.endsAt, now),
			),
		)
		.limit(1);

	return row ?? null;
}

// ── Get products with details (admin) ───────────────

async function getProductsWithDetails(offerId: string) {
	return db
		.select({
			productId: products.id,
			name: products.name,
			slug: products.slug,
			sku: products.sku,
			price: sql<string>`${products.price}::text`,
			primaryImage: sql<{ url: string; alt: string | null } | null>`(
				CASE
					WHEN EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = products.id) THEN
						jsonb_build_object(
							'url', (
								SELECT pi.url FROM product_images pi
								WHERE pi.product_id = products.id
								ORDER BY pi.is_primary DESC, pi.sort_order ASC NULLS LAST
								LIMIT 1
							),
							'alt', (
								SELECT pi.alt FROM product_images pi
								WHERE pi.product_id = products.id
								ORDER BY pi.is_primary DESC, pi.sort_order ASC NULLS LAST
								LIMIT 1
							)
						)
					ELSE NULL
				END
			)`,
		})
		.from(offerProducts)
		.innerJoin(products, eq(offerProducts.productId, products.id))
		.where(eq(offerProducts.offerId, offerId));
}

// ── Get brands with details (admin) ─────────────────

async function getBrandsWithDetails(offerId: string) {
	return db
		.select({
			brandId: brands.id,
			name: brands.name,
			slug: brands.slug,
			productCount: sql<number>`(
				SELECT COUNT(*)::int FROM products p WHERE p.brand_id = brands.id
			)`,
		})
		.from(offerBrands)
		.innerJoin(brands, eq(offerBrands.brandId, brands.id))
		.where(eq(offerBrands.offerId, offerId));
}

// ── Get categories with details (admin) ─────────────

async function getCategoriesWithDetails(offerId: string) {
	return db
		.select({
			categoryId: categories.id,
			name: categories.name,
			slug: categories.slug,
			productCount: sql<number>`(
				SELECT COUNT(*)::int FROM products p WHERE p.category_id = categories.id
			)`,
		})
		.from(offerCategories)
		.innerJoin(categories, eq(offerCategories.categoryId, categories.id))
		.where(eq(offerCategories.offerId, offerId));
}

// ── Resolved offers for product set (order calculation) ──

/**
 * Fetches all active offers applicable to a set of product IDs, resolving
 * any per-junction `overrideDiscount*` columns so the caller receives the
 * effective discount for each product.
 *
 * Result shape: `Map<productId, OfferInput[]>` ready to feed into
 * `@renovabit/pricing` `applyOfferToProduct` / `calculateOrderTotal`.
 *
 * An offer is included for a product when:
 *   - `isActive = true` AND `startsAt <= NOW()` AND `endsAt >= NOW()`, AND
 *   - type='product' AND offer matches via `offer_products`, OR
 *   - type='brand' AND product's brand is in `offer_brands`, OR
 *   - type='category' AND product's category is in `offer_categories`.
 */
async function getActiveOffersForProducts(
	productIds: ReadonlyArray<string>,
): Promise<Map<string, OfferInput[]>> {
	const result = new Map<string, OfferInput[]>();
	if (productIds.length === 0) return result;

	const now = new Date().toISOString();
	const active = sql`offers.is_active = true
		AND offers.starts_at <= ${now}::timestamptz
		AND offers.ends_at >= ${now}::timestamptz`;

	// Product-type offers: direct match
	const productOffers = await db
		.select({
			productId: offerProducts.productId,
			offerId: offers.id,
			discountType: sql<
				"percentage" | "fixed_amount"
			>`COALESCE(${offerProducts.overrideDiscountType}, ${offers.discountType})`,
			discountValue: sql<string>`COALESCE(${offerProducts.overrideDiscountValue}, ${offers.discountValue})::text`,
		})
		.from(offerProducts)
		.innerJoin(offers, eq(offers.id, offerProducts.offerId))
		.where(and(inArray(offerProducts.productId, [...productIds]), active));

	// Brand-type offers: product.brandId in offer_brands for the offer
	const brandOffers = await db
		.select({
			productId: products.id,
			offerId: offers.id,
			discountType: sql<
				"percentage" | "fixed_amount"
			>`COALESCE(${offerBrands.overrideDiscountType}, ${offers.discountType})`,
			discountValue: sql<string>`COALESCE(${offerBrands.overrideDiscountValue}, ${offers.discountValue})::text`,
		})
		.from(products)
		.innerJoin(offerBrands, eq(offerBrands.brandId, products.brandId))
		.innerJoin(offers, eq(offers.id, offerBrands.offerId))
		.where(
			and(inArray(products.id, [...productIds]), active, sql`${products.brandId} IS NOT NULL`),
		);

	// Category-type offers: product.categoryId in offer_categories
	const categoryOffers = await db
		.select({
			productId: products.id,
			offerId: offers.id,
			discountType: sql<
				"percentage" | "fixed_amount"
			>`COALESCE(${offerCategories.overrideDiscountType}, ${offers.discountType})`,
			discountValue: sql<string>`COALESCE(${offerCategories.overrideDiscountValue}, ${offers.discountValue})::text`,
		})
		.from(products)
		.innerJoin(offerCategories, eq(offerCategories.categoryId, products.categoryId))
		.innerJoin(offers, eq(offers.id, offerCategories.offerId))
		.where(
			and(inArray(products.id, [...productIds]), active, sql`${products.categoryId} IS NOT NULL`),
		);

	const push = (productId: string, input: OfferInput) => {
		const existing = result.get(productId);
		if (existing) existing.push(input);
		else result.set(productId, [input]);
	};

	for (const row of productOffers) {
		const value = Number.parseFloat(row.discountValue);
		if (value > 0)
			push(row.productId, {
				id: row.offerId,
				discountType: row.discountType,
				discountValue: value,
			});
	}
	for (const row of brandOffers) {
		const value = Number.parseFloat(row.discountValue);
		if (value > 0)
			push(row.productId, {
				id: row.offerId,
				discountType: row.discountType,
				discountValue: value,
			});
	}
	for (const row of categoryOffers) {
		const value = Number.parseFloat(row.discountValue);
		if (value > 0)
			push(row.productId, {
				id: row.offerId,
				discountType: row.discountType,
				discountValue: value,
			});
	}

	return result;
}

// ── Export ──────────────────────────────────────────

export const OfferService = {
	list,
	getById,
	getByIdStrict,
	getBySlug,
	getActiveBySlug,
	create,
	update,
	delete: deleteById,
	assignProducts,
	getProducts,
	getBrands,
	getCategories,
	assignBrands,
	assignCategories,
	getActive,
	getActiveOffersForProducts,
	getProductsWithDetails,
	getBrandsWithDetails,
	getCategoriesWithDetails,
};
