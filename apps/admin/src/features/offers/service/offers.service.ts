import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";

// ── Tipos inferidos de Eden Treaty ──

type OfferCreateBody = Parameters<typeof api.api.v1.admin.offers.post>[0];
type OfferUpdateBody = Parameters<ReturnType<typeof api.api.v1.admin.offers>["put"]>[0];

/** Single offer (create / getById / update response). Basic shape, no counts. */
export type Offer = NonNullable<
	Awaited<ReturnType<ReturnType<typeof api.api.v1.admin.offers>["get"]>>["data"]
>;

/**
 * List response wrapper from the API: `{ data: items[], total: number }`.
 * Use `ListResponse["data"][number]` to get a single list item.
 */
type ListResponse = NonNullable<Awaited<ReturnType<typeof api.api.v1.admin.offers.get>>["data"]>;

/** List item (list response). Includes computed counts. */
export type OfferListItem = ListResponse["data"][number];

// ── Tipos detallados de productos ──

export interface OfferProductDetail {
	productId: string;
	name: string;
	slug: string;
	sku: string;
	price: string;
	primaryImage: { url: string; alt: string | null } | null;
}

// ── API Functions ────────────────────────────────────

async function list(options?: {
	from?: string;
	to?: string;
	search?: string;
	isActive?: string;
	isFeatured?: string;
	limit?: number;
	offset?: number;
}): Promise<ListResponse> {
	const query: Record<string, string> = {};
	if (options?.from) query.from = options.from;
	if (options?.to) query.to = options.to;
	if (options?.search) query.search = options.search;
	if (options?.isActive) query.isActive = options.isActive;
	if (options?.isFeatured) query.isFeatured = options.isFeatured;
	if (options?.limit !== undefined) query.limit = String(options.limit);
	if (options?.offset !== undefined) query.offset = String(options.offset);

	return unwrapResponse(
		api.api.v1.admin.offers.get(Object.keys(query).length > 0 ? { query } : undefined),
	);
}

async function getById(id: string): Promise<Offer> {
	return unwrapResponse(api.api.v1.admin.offers({ id }).get());
}

async function create(data: OfferCreateBody): Promise<Offer> {
	return unwrapResponse(api.api.v1.admin.offers.post(data));
}

async function update(id: string, data: OfferUpdateBody): Promise<Offer> {
	return unwrapResponse(api.api.v1.admin.offers({ id }).put(data));
}

async function remove(id: string): Promise<void> {
	await unwrapResponse(api.api.v1.admin.offers({ id }).delete());
}

async function getProductsWithDetails(offerId: string): Promise<OfferProductDetail[]> {
	return unwrapResponse(api.api.v1.admin.offers({ id: offerId }).products.get());
}

// ── Public API ──

export const offersService = {
	list,
	getById,
	create,
	update,
	delete: remove,
	getProducts: getProductsWithDetails,
};
