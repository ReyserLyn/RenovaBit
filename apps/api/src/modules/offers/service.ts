/**
 * Offer service — DB operations, business logic, and shared SQL fragments.
 */
import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { brands, offerProducts, offers, products } from "@renovabit/db/schema";
import {
	applyOfferToProduct,
	getEffectiveSalePrice,
	type OfferInput,
	type Role,
} from "@renovabit/pricing";
import { and, asc, desc, eq, getTableColumns, gte, ilike, inArray, lte, sql } from "drizzle-orm";
import { peruDateToUtcEnd, peruDateToUtcStart } from "@/utils/date";
import { handleUniqueViolation, makeSlug } from "@/utils/db-helpers";
import { logger } from "@/utils/logger";
import { getActiveMarginRules } from "@/utils/margin-rules";
import { getReservedStockSubquery } from "@/utils/stock";
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
	discountValue: string;
	isFeatured: boolean;
};

/**
 * SQL fragment that aggregates all active offers applicable to a single
 * product row, as a `jsonb_agg` subquery returning `ActiveOfferRef[]`.
 *
 * The function is role-agnostic — it always returns ALL active offers
 * that match the product. Role-based price filtering is done downstream
 * by `applyOfferToProduct` in the pricing engine.
 *
 * An offer applies to a product when:
 *   - `is_active = true` AND `starts_at <= NOW()` AND `ends_at >= NOW()`, AND
 *   - EXISTS a row in `offer_products` linking the offer to this product.
 *
 * Must be used inside a `db.select().from(products)` context so the
 * `products.id` column ref resolves.
 *
 * Returns `[]` on error to avoid 500-ing the entire product catalog
 * when the offers table has a transient issue (lock, hiccup, etc.).
 */
export function activeOffersForProductSubquery() {
	try {
		return sql<ActiveOfferRef[]>`COALESCE(
			(
				SELECT jsonb_agg(jsonb_build_object(
					'id', o.id,
					'name', o.name,
					'slug', o.slug,
					'discountValue', o.discount_value::text,
					'isFeatured', o.is_featured
				))
				FROM offers o
				WHERE o.is_active = true
					AND o.starts_at <= NOW()
					AND o.ends_at >= NOW()
					AND EXISTS (SELECT 1 FROM offer_products op WHERE op.offer_id = o.id AND op.product_id = ${products.id})
			),
			'[]'::jsonb
		)`;
	} catch (err) {
		logger
			.withError(err)
			.warn("offers.activeOffersForProductSubquery.failed — returning empty array as fallback");
		return sql<ActiveOfferRef[]>`'[]'::jsonb`;
	}
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

// Note: `ensureBrandsExist` and `ensureCategoriesExist` removed — all offers are product-only now.

// ── List ────────────────────────────────────────────

async function list(options: {
	search?: string;
	isActive?: string;
	isFeatured?: string;
	from?: string;
	to?: string;
	limit?: number;
	offset?: number;
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
		const fromDate = peruDateToUtcStart(options.from);
		if (fromDate) {
			conditions.push(gte(offers.createdAt, fromDate));
		}
	}
	if (options.to) {
		const toDate = peruDateToUtcEnd(options.to);
		if (toDate) {
			conditions.push(lte(offers.createdAt, toDate));
		}
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const limit = options.limit ?? 20;
	const offset = options.offset ?? 0;

	const [[countRow], data] = await Promise.all([
		db.select({ total: sql<number>`COUNT(*)::int` }).from(offers).where(where),
		db
			.select({
				...getTableColumns(offers),
				discountValue: sql<string>`${offers.discountValue}::text`,
				productCount: sql<number>`(
					SELECT COUNT(*)::int FROM offer_products op WHERE op.offer_id = offers.id
				)`,
			})
			.from(offers)
			.where(where)
			.orderBy(desc(offers.createdAt))
			.limit(limit)
			.offset(offset),
	]);

	const total = countRow?.total ?? 0;

	return { data, total };
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

	// ── Discount-value validation ──
	if (data.discountValue > 100) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "El descuento porcentual no puede ser mayor a 100%",
			logLevel: "info",
			doNotLog: true,
		});
	}

	// ── Date validation ──
	assertDateRange(data.startsAt, data.endsAt);

	// ── FK validation ──
	if (data.productIds?.length) {
		await ensureProductsExist(data.productIds);
	}

	const row = await db.transaction(async (tx) => {
		const [inserted] = await tx
			.insert(offers)
			.values({
				name: data.name,
				slug: nextSlug,
				description: data.description ?? null,
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
		if (data.productIds?.length) {
			const values = data.productIds.map((productId) => {
				const override = data.overrides?.[productId];
				return {
					offerId: inserted.id,
					productId,
					overrideDiscountValue:
						override?.overrideDiscountValue != null ? String(override.overrideDiscountValue) : null,
				};
			});

			await tx.insert(offerProducts).values(values);
		}

		return inserted;
	});

	logger
		.withMetadata({
			offerId: row.id,
			offerName: row.name,
			userId,
			productCount: data.productIds?.length ?? 0,
		})
		.info("offer.created");

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
	if (data.productIds !== undefined) {
		if (data.productIds.length === 0) {
			throw createApiError({
				code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
				message:
					"No puedes eliminar todos los productos de una oferta mediante actualización. Usa el endpoint de eliminar oferta si deseas removerla por completo.",
				logLevel: "info",
				doNotLog: true,
			});
		}
		await ensureProductsExist(data.productIds);
	}

	const { updatedRow } = await db.transaction(async (tx) => {
		const updateData: Partial<typeof offers.$inferInsert> = {};

		if (data.name !== undefined) updateData.name = data.name;
		if (data.description !== undefined) updateData.description = data.description;
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

		// ── Discount-value validation (belt + suspenders) ──
		if (data.discountValue !== undefined && data.discountValue > 100) {
			throw createApiError({
				code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
				message: "El descuento porcentual no puede ser mayor a 100%",
				logLevel: "info",
				doNotLog: true,
			});
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

		// Update product assignments if provided

		if (data.productIds !== undefined) {
			const existingRows = await tx
				.select()
				.from(offerProducts)
				.where(eq(offerProducts.offerId, id));
			const existingByProduct = new Map(existingRows.map((r) => [r.productId, r]));
			const newSet = new Set(data.productIds);

			// Delete rows that are no longer in the new set
			const toRemove = existingRows.filter((r) => !newSet.has(r.productId));
			if (toRemove.length > 0) {
				await tx.delete(offerProducts).where(
					and(
						eq(offerProducts.offerId, id),
						inArray(
							offerProducts.productId,
							toRemove.map((r) => r.productId),
						),
					),
				);
			}

			// Insert new products (no overrides — update flow doesn't send them)
			for (const productId of data.productIds) {
				if (!existingByProduct.has(productId)) {
					await tx.insert(offerProducts).values({
						offerId: id,
						productId,
					});
				}
			}
		}

		// Note: brand and category assignment were removed — all offers are product-only now.

		return { updatedRow };
	});

	logger
		.withMetadata({
			offerId: id,
			userId,
		})
		.info("offer.updated");

	return updatedRow;
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

	logger
		.withMetadata({
			offerId: id,
			offerName: row.name,
		})
		.info("offer.deleted");

	return row;
}

// ── Assign products (admin) ─────────────────────────

/**
 * Assign products to an offer (admin).
 *
 * Policy: overrides on existing junction rows are PRESERVED unless
 * explicitly cleared by the client (set to null in the overrides map).
 * - If a productId is in the new list AND already exists → keep existing overrides
 *   (unless the override is explicitly set in `overrides[productId]`).
 * - If a productId is in the new list but NOT in the existing rows → insert
 *   with the provided override or null.
 * - If a productId is NOT in the new list → delete the junction row.
 */
async function assignProducts(
	offerId: string,
	productIds: string[],
	overrides?: Record<
		string,
		{
			overrideDiscountValue?: number | null;
		}
	>,
) {
	await getByIdStrict(offerId);

	if (productIds.length > 0) {
		await ensureProductsExist(productIds);
	}

	return db.transaction(async (tx) => {
		// Fetch existing junction rows
		const existing = await tx
			.select()
			.from(offerProducts)
			.where(eq(offerProducts.offerId, offerId));
		const existingByProduct = new Map(existing.map((r) => [r.productId, r]));

		const newSet = new Set(productIds);

		// Delete rows that are no longer in the new incoming set
		const toRemove = existing.filter((r) => !newSet.has(r.productId));
		if (toRemove.length > 0) {
			await tx.delete(offerProducts).where(
				and(
					eq(offerProducts.offerId, offerId),
					inArray(
						offerProducts.productId,
						toRemove.map((r) => r.productId),
					),
				),
			);
		}

		// Collect new rows for batch insert
		const toInsert: Array<typeof offerProducts.$inferInsert> = [];

		for (const productId of productIds) {
			const existingRow = existingByProduct.get(productId);
			const override = overrides?.[productId];

			if (existingRow) {
				const patch: Record<string, unknown> = {};
				const hasExplicitOverrideValue = override && "overrideDiscountValue" in override;

				if (hasExplicitOverrideValue && override!.overrideDiscountValue === null) {
					patch.overrideDiscountValue = null;
				} else if (override?.overrideDiscountValue !== undefined) {
					patch.overrideDiscountValue = String(override.overrideDiscountValue);
				}

				if (Object.keys(patch).length > 0) {
					await tx
						.update(offerProducts)
						.set(patch)
						.where(and(eq(offerProducts.offerId, offerId), eq(offerProducts.productId, productId)));
				}
			} else {
				toInsert.push({
					offerId,
					productId,
					overrideDiscountValue:
						override?.overrideDiscountValue != null ? String(override.overrideDiscountValue) : null,
				});
			}
		}

		if (toInsert.length > 0) {
			await tx.insert(offerProducts).values(toInsert);
		}

		return { offerId, assignedCount: productIds.length };
	});

	logger
		.withMetadata({
			offerId,
			assignedCount: productIds.length,
		})
		.info("offer.productsAssigned");

	return { offerId, assignedCount: productIds.length };
}

// ── Get products for an offer (public) ──────────────

async function getProducts(offerId: string) {
	return db
		.select({ productId: offerProducts.productId })
		.from(offerProducts)
		.where(eq(offerProducts.offerId, offerId));
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
			SELECT jsonb_build_object('url', pi.url, 'alt', pi.alt)
			FROM product_images pi
			WHERE pi.product_id = products.id
			ORDER BY pi.is_primary DESC, pi.sort_order ASC NULLS LAST
			LIMIT 1
		)`,
		})
		.from(offerProducts)
		.innerJoin(products, eq(offerProducts.productId, products.id))
		.where(eq(offerProducts.offerId, offerId));
}

// Note: `getBrandsWithDetails` and `getCategoriesWithDetails` removed — all offers are product-only now.

// ── Resolved offers for product set (order calculation) ──

/**
 * Fetches all active offers applicable to a set of product IDs, resolving
 * any per-junction `overrideDiscount*` columns so the caller receives the
 * effective discount for each product.
 *
 * Role guard: admin returns empty Map (admin always sees raw supplier pricing).
 * Customer and distributor receive all active offers — the role-based price
 * filtering is done by `applyOfferToProduct` downstream.
 *
 * Result shape: `Map<productId, OfferInput[]>` ready to feed into
 * `@renovabit/pricing` `applyOfferToProduct` / `calculateOrderTotal`.
 *
 * An offer is included for a product when:
 *   - `isActive = true` AND `startsAt <= NOW()` AND `endsAt >= NOW()`, AND
 *   - offer matches via `offer_products`.
 *
 * @param role - The caller's user role. If `'admin'`, returns empty Map.
 * @param productIds - Product IDs to resolve offers for.
 */
async function getActiveOffersForProducts(
	role: Role,
	productIds: ReadonlyArray<string>,
): Promise<Map<string, OfferInput[]>> {
	const result = new Map<string, OfferInput[]>();
	if (role === "admin") return result;
	if (productIds.length === 0) return result;

	const now = new Date().toISOString();
	const active = sql`offers.is_active = true
		AND offers.starts_at <= ${now}::timestamptz
		AND offers.ends_at >= ${now}::timestamptz`;

	// Product-type offers: direct match (only product-type is supported now)
	const productOffers = await db
		.select({
			productId: offerProducts.productId,
			offerId: offers.id,
			discountValue: sql<string>`COALESCE(${offerProducts.overrideDiscountValue}, ${offers.discountValue})::text`,
		})
		.from(offerProducts)
		.innerJoin(offers, eq(offers.id, offerProducts.offerId))
		.where(and(inArray(offerProducts.productId, [...productIds]), active));

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
				discountValue: value,
			});
	}

	return result;
}

/**
 * Consolidated: get active offers with their enriched products and filter options.
 *
 * If `offerId` is provided, returns only that offer with the requested product page.
 * Otherwise returns all active offers with their first page of products.
 *
 * @param role - Current user role
 * @param options.offset - Offer list offset
 * @param options.limit - Offer list page size
 * @param options.isFeatured - Filter featured offers
 * @param options.brandId - Filter offers with products of this brand
 * @param options.offerId - Load a specific offer's product page
 * @param options.productsOffset - Product page offset (requires offerId)
 * @param options.productsLimit - Product page size (requires offerId)
 */
async function getOffersWithProducts(
	role: Role = "customer",
	options: {
		offset?: number;
		limit?: number;
		isFeatured?: string;
		brandId?: string;
		offerId?: string;
		productsOffset?: number;
		productsLimit?: number;
	} = {},
) {
	const now = new Date();

	// ── 1. Build offer conditions ──
	const offerConditions: ReturnType<typeof and>[] = [
		eq(offers.isActive, true),
		lte(offers.startsAt, now),
		gte(offers.endsAt, now),
	];
	if (options.isFeatured === "true") {
		offerConditions.push(eq(offers.isFeatured, true));
	} else if (options.isFeatured === "false") {
		offerConditions.push(eq(offers.isFeatured, false));
	}
	if (options.brandId) {
		offerConditions.push(
			sql`EXISTS (
				SELECT 1 FROM offer_products op
				INNER JOIN products p ON p.id = op.product_id
				WHERE op.offer_id = offers.id AND p.brand_id = ${options.brandId}
			)`,
		);
	}
	if (options.offerId) {
		offerConditions.push(eq(offers.id, options.offerId));
	}
	const offerWhere = and(...offerConditions);

	// ── 2. Fetch active offers ──
	const activeRows = await db
		.select({
			id: offers.id,
			name: offers.name,
			slug: offers.slug,
			description: offers.description,
			discountValue: sql<string>`${offers.discountValue}::text`,
			isFeatured: sql<boolean>`COALESCE(${offers.isFeatured}, false)`,
			startsAt: offers.startsAt,
			endsAt: offers.endsAt,
		})
		.from(offers)
		.where(offerWhere)
		.orderBy(desc(offers.createdAt))
		.offset(options.offerId ? 0 : (options.offset ?? 0))
		.limit(options.offerId ? 1 : (options.limit ?? 20));

	// ── 3. Preload margin rules ──
	const marginRules = await getActiveMarginRules();

	// ── 4. For each offer, get enriched products ──
	const offersWithProducts = await Promise.all(
		activeRows.map(async (offer) => {
			const prodOffset = options.offerId === offer.id ? (options.productsOffset ?? 0) : 0;
			const prodLimit = options.offerId === offer.id ? (options.productsLimit ?? 20) : 20;

			// Build WHERE conditions for products
			const prodConditions: ReturnType<typeof and>[] = [eq(offerProducts.offerId, offer.id)];
			if (options.brandId) {
				prodConditions.push(eq(products.brandId, options.brandId));
			}
			const prodWhere = prodConditions.length > 0 ? and(...prodConditions) : undefined;

			// Count total matching products
			const [countRow] = await db
				.select({ total: sql<number>`COUNT(*)::int` })
				.from(offerProducts)
				.innerJoin(products, eq(offerProducts.productId, products.id))
				.where(prodWhere);
			const total = countRow?.total ?? 0;

			// Fetch paginated products
			const rows = await db
				.select({
					id: products.id,
					name: products.name,
					slug: products.slug,
					primaryImage: sql<string | null>`(
						SELECT pi.url FROM product_images pi
						WHERE pi.product_id = ${products.id}
						ORDER BY pi.is_primary DESC, pi.sort_order ASC NULLS LAST
						LIMIT 1
					)`,
					stock: sql<number>`GREATEST(0, ${products.stock} - COALESCE((${getReservedStockSubquery(products.id)})::int, 0))`,
					supplierPrice: products.supplierPrice,
					roleCustomMargins: products.roleCustomMargins,
					brandId: brands.id,
					brandName: brands.name,
					brandSlug: brands.slug,
					discountValue: sql<string>`COALESCE(${offerProducts.overrideDiscountValue}, ${offers.discountValue})::text`,
				})
				.from(offerProducts)
				.innerJoin(products, eq(offerProducts.productId, products.id))
				.innerJoin(offers, eq(offers.id, offerProducts.offerId))
				.leftJoin(brands, eq(products.brandId, brands.id))
				.where(prodWhere)
				.orderBy(asc(products.name), asc(products.id))
				.offset(prodOffset)
				.limit(prodLimit);

			// Compute prices
			const productsList = rows.map((row) => {
				const { salePrice } = getEffectiveSalePrice(
					{
						supplierPrice: row.supplierPrice,
						roleCustomMargins: row.roleCustomMargins,
					},
					role,
					marginRules,
				);

				const offerResult = applyOfferToProduct(
					salePrice,
					[
						{
							discountValue: Number.parseFloat(row.discountValue),
						},
					],
					role,
				);

				const basePriceStr = salePrice.toFixed(2);
				const offerPriceStr = offerResult.discountedPrice.toFixed(2);

				const discountPercent =
					salePrice > 0
						? Math.round(((salePrice - offerResult.discountedPrice) / salePrice) * 100)
						: 0;

				return {
					id: row.id,
					name: row.name,
					slug: row.slug,
					primaryImage: row.primaryImage,
					brand: row.brandId
						? { id: row.brandId, name: row.brandName!, slug: row.brandSlug! }
						: null,
					basePrice: basePriceStr,
					offerPrice: offerPriceStr,
					discountPercent,
					inStock: row.stock > 0,
					stock: row.stock,
				};
			});

			const nextOffset =
				prodOffset + productsList.length < total ? prodOffset + productsList.length : null;

			return {
				id: offer.id,
				name: offer.name,
				slug: offer.slug,
				description: offer.description,
				discountValue: offer.discountValue,
				isFeatured: offer.isFeatured,
				startsAt: offer.startsAt,
				endsAt: offer.endsAt,
				products: {
					items: productsList,
					nextOffset,
					total,
				},
			};
		}),
	);

	// ── 5. Collect unique brands from all returned products ──
	const brandSet = new Map<string, { id: string; name: string; slug: string }>();
	for (const offer of offersWithProducts) {
		for (const product of offer.products.items) {
			if (product.brand && !brandSet.has(product.brand.id)) {
				brandSet.set(product.brand.id, product.brand);
			}
		}
	}

	// Note: `requiresCustomerRole` was removed — role-based filtering
	// is now handled by `applyOfferToProduct` in the pricing engine.

	return {
		offers: offersWithProducts,
		filters: {
			brands: Array.from(brandSet.values()),
		},
	};
}

// ── Export ──────────────────────────────────────────

export const OfferService = {
	list,
	getById,
	getByIdStrict,
	getBySlug,
	create,
	update,
	delete: deleteById,
	assignProducts,
	getProducts,
	getActiveOffersForProducts,
	getProductsWithDetails,

	// Consolidated
	getOffersWithProducts,
};
