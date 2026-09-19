/**
 * Offer service — DB operations, business logic, and shared SQL fragments.
 */
import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { brands, offerProducts, offers, products } from "@renovabit/db/schema";
import { applyOfferToProduct, type OfferInput, type Role } from "@renovabit/pricing";
import { and, asc, desc, eq, getTableColumns, gte, ilike, inArray, lte, sql } from "drizzle-orm";
import { peruDateToUtcEnd, peruDateToUtcStart } from "@/utils/date";
import { handleUniqueViolation, makeSlug } from "@/utils/db-helpers";
import { logger } from "@/utils/logger";
import { getActiveMarginRules } from "@/utils/margin-rules";
import { resolveSalePrice } from "@/utils/price";
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
	endsAt: Date;
};

/**
 * SQL fragment that aggregates all active offers applicable to a single
 * product row, as a `jsonb_agg` subquery returning `ActiveOfferRef[]`.
 *
 * The function is role-agnostic — it always returns ALL active offers
 * that match the product. Role-aware price resolution and the "best offer
 * wins" rule are applied downstream by the pricing engine.
 *
 * Each entry carries the EFFECTIVE discount for this product: a per-product
 * override (`offer_products.override_discount_value`) replaces the offer's
 * base discount. This MUST stay aligned with `getActiveOffersForProducts`
 * (cart/checkout path) so the displayed price equals the charged price.
 *
 * Must be used inside a `db.select().from(products)` context so the
 * `products.id` column ref resolves.
 *
 * The outer id reference is written as a literal qualified identifier: when
 * callers spread `getTableColumns(products)` into the same selection, Drizzle
 * renders a plain `products.id` column reference unqualified (`"id"`), which
 * then resolves to `o.id` inside this subquery and matches nothing. The
 * qualified identifier is context-independent and renders the same SQL
 * elsewhere.
 */
export function activeOffersForProductSubquery() {
	return sql<ActiveOfferRef[]>`COALESCE(
		(
			SELECT jsonb_agg(jsonb_build_object(
				'id', o.id,
				'name', o.name,
				'slug', o.slug,
				'discountValue', COALESCE(op.override_discount_value, o.discount_value)::text,
				'isFeatured', o.is_featured,
				'endsAt', o.ends_at
			))
			FROM offers o
			INNER JOIN ${offerProducts} op ON op.offer_id = o.id AND op.product_id = "products"."id"
			WHERE o.is_active = true
				AND o.starts_at <= NOW()
				AND o.ends_at >= NOW()
		),
		'[]'::jsonb
	)`;
}

// ── FK validation ──────────────────────────────────

/**
 * Validates that every product exists and returns the deduplicated list.
 *
 * Duplicates (`[P, P]`) must be collapsed before comparing: `rows.length`
 * counts distinct products, so comparing it against raw input length would
 * report "Uno o más productos no existen" for a product that does exist.
 * Callers must use the returned list — the `offer_products` PK is
 * `(offer_id, product_id)`, so re-inserting a duplicate would 500.
 */
async function ensureProductsExist(productIds: string[]): Promise<string[]> {
	if (productIds.length === 0) return productIds;
	const uniqueIds = [...new Set(productIds)];
	const rows = await db
		.select({ id: products.id })
		.from(products)
		.where(inArray(products.id, uniqueIds));
	if (rows.length !== uniqueIds.length) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Uno o más productos no existen",
			logLevel: "info",
			doNotLog: true,
		});
	}
	return uniqueIds;
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
			.orderBy(desc(offers.isFeatured), asc(offers.endsAt), desc(offers.createdAt))
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

	// ── Date validation ──
	assertDateRange(data.startsAt, data.endsAt);

	// ── FK validation (returns the deduplicated list) ──
	const productIds = data.productIds?.length ? await ensureProductsExist(data.productIds) : [];

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
				// Offers start INACTIVE unless explicitly activated. Deliberately the
				// opposite of the column default (`true`) so an offer never goes live
				// by omitting `isActive`.
				isActive: data.isActive ?? false,
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

		// Insert product assignments (deduplicated list)
		if (productIds.length > 0) {
			const values = productIds.map((productId) => {
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
			productCount: productIds.length,
		})
		.info("offer.created");

	return row;
}

// ── Update ──────────────────────────────────────────

async function update(id: string, data: UpdateOfferDto, userId: string) {
	const current = await getByIdStrict(id);

	// ── Date validation: check the merged range so a single-bound update
	//     can't produce an inverted window (e.g. endsAt < stored startsAt). ──
	if (data.startsAt !== undefined || data.endsAt !== undefined) {
		const nextStartsAt = data.startsAt ?? current.startsAt;
		const nextEndsAt = data.endsAt ?? current.endsAt;
		assertDateRange(nextStartsAt, nextEndsAt);
	}

	// ── FK validation (before junction replacement; returns deduplicated ids) ──
	// An empty array is a valid UPDATE: it clears every product assignment, which
	// the admin form's "Limpiar" action relies on. CREATE keeps its own semantics.
	let nextProductIds: string[] | undefined;
	if (data.productIds !== undefined) {
		nextProductIds = await ensureProductsExist(data.productIds);
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

		if (nextProductIds !== undefined) {
			const existingRows = await tx
				.select()
				.from(offerProducts)
				.where(eq(offerProducts.offerId, id));
			const existingByProduct = new Map(existingRows.map((r) => [r.productId, r]));
			const newSet = new Set(nextProductIds);

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
			for (const productId of nextProductIds) {
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

	// Deduplicated ids: the junction PK is (offer_id, product_id).
	const uniqueProductIds =
		productIds.length > 0 ? await ensureProductsExist(productIds) : productIds;

	return db.transaction(async (tx) => {
		// Fetch existing junction rows
		const existing = await tx
			.select()
			.from(offerProducts)
			.where(eq(offerProducts.offerId, offerId));
		const existingByProduct = new Map(existing.map((r) => [r.productId, r]));

		const newSet = new Set(uniqueProductIds);

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

		for (const productId of uniqueProductIds) {
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

		return { offerId, assignedCount: uniqueProductIds.length };
	});

	logger
		.withMetadata({
			offerId,
			assignedCount: uniqueProductIds.length,
		})
		.info("offer.productsAssigned");

	return { offerId, assignedCount: uniqueProductIds.length };
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
 * Customer receives all active offers — the role-based price
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
 * @param options.brandSlugs - Comma-separated brand slugs to filter offers whose products match
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
		brandSlugs?: string;
		offerId?: string;
		productsOffset?: number;
		productsLimit?: number;
		minPrice?: string;
		maxPrice?: string;
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

	// Resolve brand slugs → IDs ONCE. Reused for the offer EXISTS condition
	// and the per-offer product filter (avoids N+1 brand-lookup queries).
	let resolvedBrandIds: string[] | undefined;
	if (options.brandSlugs) {
		const slugs = options.brandSlugs
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		if (slugs.length > 0) {
			const rows = await db
				.select({ id: brands.id })
				.from(brands)
				.where(inArray(brands.slug, slugs));
			resolvedBrandIds = rows.map((r) => r.id);
			if (resolvedBrandIds.length === 0) {
				// Unknown slugs: no product can match, so no offer qualifies.
				// Mirrors `listPublic` (products/service.ts), which returns an
				// empty set. The brand filter list stays complete so the sidebar
				// doesn't shrink on a stale slug in the URL.
				return {
					offers: [],
					filters: { brands: await getAllBrandsWithActiveOffers() },
				};
			}
			offerConditions.push(
				sql`EXISTS (
					SELECT 1 FROM offer_products op
					INNER JOIN products p ON p.id = op.product_id
					WHERE op.offer_id = offers.id AND p.brand_id = ANY(ARRAY[${sql.join(
						resolvedBrandIds.map((id) => sql`${id}::uuid`),
						sql`, `,
					)}]::uuid[])
				)`,
			);
		}
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
		.orderBy(
			desc(sql`COALESCE(${offers.isFeatured}, false)`),
			asc(offers.endsAt),
			desc(offers.createdAt),
		)
		.offset(options.offerId ? 0 : (options.offset ?? 0))
		.limit(options.offerId ? 1 : (options.limit ?? 20));

	// ── 3. Preload margin rules ──
	const marginRules = await getActiveMarginRules();

	// Effective-price filter bounds (role-aware + offer-aware, JS-only).
	const priceMin = options.minPrice ? Number.parseFloat(options.minPrice) : null;
	const priceMax = options.maxPrice ? Number.parseFloat(options.maxPrice) : null;
	const hasPriceFilter = priceMin !== null || priceMax !== null;

	// ── 4. For each offer, get enriched products ──
	const offersWithProducts = await Promise.all(
		activeRows.map(async (offer) => {
			const prodOffset = options.offerId === offer.id ? (options.productsOffset ?? 0) : 0;
			const prodLimit = options.offerId === offer.id ? (options.productsLimit ?? 20) : 20;

			// Build WHERE conditions for products.
			// Visibility: only active, non-review products are exposed publicly —
			// mirrors `PUBLIC_DETAIL_CONDITIONS` in products/service.ts.
			const prodConditions: ReturnType<typeof and>[] = [
				eq(offerProducts.offerId, offer.id),
				eq(products.isActive, true),
				eq(products.needsReview, false),
			];
			if (resolvedBrandIds?.length) {
				prodConditions.push(inArray(products.brandId, resolvedBrandIds));
			}
			const prodWhere = prodConditions.length > 0 ? and(...prodConditions) : undefined;

			// ── Products fetch + pagination strategy (two routes) ──
			// Effective price (role margins + best offer) is resolved in JS.
			// With a price filter, SQL OFFSET/LIMIT would cut the window before
			// the filter runs (offset applied to the unfiltered set), so page 2
			// could repeat or skip products. Fetch the full offer set and page
			// after enriching + filtering. Without a filter, SQL OFFSET/LIMIT is
			// exact; its stored-price order is an approximation of the
			// effective-price order — acceptable for the default view.
			//
			// TODO(perf): materialize the effective price if catalogs grow.
			const selectProductRows = () =>
				db
					.select({
						id: products.id,
						name: products.name,
						slug: products.slug,
						sku: products.sku,
						primaryImage: sql<string | null>`(
					SELECT pi.url FROM product_images pi
					WHERE pi.product_id = ${products.id}
					ORDER BY pi.is_primary DESC, pi.sort_order ASC NULLS LAST
					LIMIT 1
				)`,
						stock: sql<number>`GREATEST(0, ${products.stock} - COALESCE((${getReservedStockSubquery(products.id)})::int, 0))`,
						supplierPrice: products.supplierPrice,
						roleCustomMargins: products.roleCustomMargins,
						managedBy: products.managedBy,
						price: products.price,
						brandId: brands.id,
						brandName: brands.name,
						brandSlug: brands.slug,
					})
					.from(offerProducts)
					.innerJoin(products, eq(offerProducts.productId, products.id))
					.leftJoin(brands, eq(products.brandId, brands.id))
					.where(prodWhere)
					.orderBy(asc(products.price), asc(products.id));

			const rows = hasPriceFilter
				? await selectProductRows()
				: await selectProductRows().offset(prodOffset).limit(prodLimit);

			// Count the full offer set. The JS path computes the exact filtered
			// count after pricing below.
			let total = 0;
			if (!hasPriceFilter) {
				const [countRow] = await db
					.select({ total: sql<number>`COUNT(*)::int` })
					.from(offerProducts)
					.innerJoin(products, eq(offerProducts.productId, products.id))
					.where(prodWhere);
				total = countRow?.total ?? 0;
			}

			// Price with ALL of the product's active offers ("best offer wins"),
			// exactly like the catalog and checkout — the campaign view must show
			// the price the customer actually pays.
			const allOffersByProduct = await getActiveOffersForProducts(
				role,
				rows.map((row) => row.id),
			);

			// Compute prices and apply the role-aware price filter
			const priceFiltered = rows
				.map((row) => {
					const salePrice = resolveSalePrice(row, role, marginRules);

					const offerResult = applyOfferToProduct(
						salePrice,
						allOffersByProduct.get(row.id) ?? [],
						role,
					);

					const basePriceStr = salePrice.toFixed(2);
					// Effective price the customer pays: offer price when offer applies
					// (discountedPrice < salePrice), else base price. Used for filtering.
					const effectivePrice = offerResult.discountedPrice;
					const offerPriceStr =
						offerResult.discountedPrice < salePrice ? offerResult.discountedPrice.toFixed(2) : null;
					// discountPercent is null when no offer applies (or admin) so the
					// client can skip rendering the badge. Mirrors products/service.ts.
					const discountPercent =
						offerPriceStr !== null
							? Math.round(((salePrice - offerResult.discountedPrice) / salePrice) * 100)
							: null;

					return {
						row,
						basePriceStr,
						offerPriceStr,
						discountPercent,
						effectivePrice,
					};
				})
				.filter(({ effectivePrice }) => {
					if (priceMin !== null && effectivePrice < priceMin) return false;
					if (priceMax !== null && effectivePrice > priceMax) return false;
					return true;
				});

			// JS path: sort by effective price and slice the requested window of
			// the FILTERED set; `total` becomes the exact filtered count. SQL
			// path: the fetch is already the requested window.
			let pageItems = priceFiltered;
			if (hasPriceFilter) {
				priceFiltered.sort(
					(a, b) => a.effectivePrice - b.effectivePrice || a.row.id.localeCompare(b.row.id),
				);
				pageItems = priceFiltered.slice(prodOffset, prodOffset + prodLimit);
				total = priceFiltered.length;
			}

			const productsList = pageItems.map(
				({ row, basePriceStr, offerPriceStr, discountPercent }) => ({
					id: row.id,
					name: row.name,
					slug: row.slug,
					sku: row.sku,
					primaryImage: row.primaryImage,
					brand: row.brandId
						? { id: row.brandId, name: row.brandName!, slug: row.brandSlug! }
						: null,
					basePrice: basePriceStr,
					offerPrice: offerPriceStr,
					discountPercent,
					inStock: row.stock > 0,
					stock: row.stock,
				}),
			);

			// Exact off the filtered set: `prodOffset` is the client's window over it.
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

	// ── 5. All brands with at least one active offer ──
	// Independent of pagination/filter so the sidebar brand list doesn't
	// shrink when the user picks one brand.
	const allBrands = await getAllBrandsWithActiveOffers();

	return {
		offers: offersWithProducts,
		filters: {
			brands: allBrands,
		},
	};
}

// ── Brands with at least one active offer ─────────

/**
 * Returns every brand that has at least one product linked to an
 * offer that is active and within its date window. Used by the
 * tienda sidebar so the brand list stays stable across pagination
 * and brand filtering.
 */
async function getAllBrandsWithActiveOffers(): Promise<
	Array<{ id: string; name: string; slug: string; productCount: number }>
> {
	const now = new Date();
	// Count distinct products per brand that are linked to a live offer.
	// Uses a subquery so each brand row is one line (avoids the row
	// explosion you'd get with select + groupBy on a multi-join).
	const countSq = db
		.select({
			brandId: products.brandId,
			count: sql<number>`COUNT(DISTINCT ${products.id})::int`.as("count"),
		})
		.from(products)
		.innerJoin(offerProducts, eq(offerProducts.productId, products.id))
		.innerJoin(
			offers,
			and(
				eq(offers.id, offerProducts.offerId),
				eq(offers.isActive, true),
				lte(offers.startsAt, now),
				gte(offers.endsAt, now),
			),
		)
		.groupBy(products.brandId)
		.as("brand_offer_counts");

	const rows = await db
		.select({
			id: brands.id,
			name: brands.name,
			slug: brands.slug,
			productCount: countSq.count,
		})
		.from(brands)
		.innerJoin(countSq, eq(countSq.brandId, brands.id))
		.orderBy(asc(brands.name));
	return rows;
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
	getActiveOffersForProducts,
	getProductsWithDetails,

	// Consolidated
	getOffersWithProducts,
};
