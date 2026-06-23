/**
 * Offer server functions — consolidated list with products.
 * Calls GET /api/v1/offers with optional params for pagination and filtering.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { api } from "@/shared/lib/api/api-client";
import type { OffersListResponse } from "../types";

// ── Input types ─────────────────────────────────────

export interface GetOffersInput {
	offset?: number;
	limit?: number;
	isFeatured?: string;
	brandSlugs?: string;
	offerId?: string;
	productsOffset?: number;
	productsLimit?: number;
}

// ── Consolidated offers list (with products) ────────

export const getOffersWithProductsServerFn = createServerFn({ method: "GET" })
	.validator((input: GetOffersInput) => input)
	.handler(async ({ data }) => {
		try {
			const reqHeaders = getRequestHeaders();
			const cookie = reqHeaders.get("cookie") ?? "";

			const { data: result, error } = await api.api.v1.offers.get({
				headers: { cookie },
				query: {
					offset: data.offset,
					limit: data.limit,
					isFeatured: data.isFeatured,
					brands: data.brandSlugs,
					offerId: data.offerId,
					productsOffset: data.productsOffset,
					productsLimit: data.productsLimit,
				},
			});

			if (error || !result) return null;
			return result as unknown as OffersListResponse;
		} catch {
			return null;
		}
	});
