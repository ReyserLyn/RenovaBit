import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";
import type { Brand, BrandBulkDeleteResult } from "../model";

// ── Body types derivados de Eden Treaty (SSOT con la API) ──

type CreateBody = Parameters<typeof api.api.v1.brands.post>[0];
type UpdateBody = Parameters<ReturnType<typeof api.api.v1.brands>["patch"]>[0];
type BulkDeleteBody = Parameters<typeof api.api.v1.brands.bulk.post>[0];

// ── API Functions ────────────────────────────────────

async function list(): Promise<Brand[]> {
	return unwrapResponse(api.api.v1.brands.get());
}

async function getBySlug(slug: string): Promise<Brand> {
	return unwrapResponse(api.api.v1.brands({ slug }).get());
}

async function create(data: CreateBody): Promise<Brand> {
	return unwrapResponse(api.api.v1.brands.post(data));
}

async function update(slug: string, data: UpdateBody): Promise<Brand> {
	return unwrapResponse(api.api.v1.brands({ slug }).patch(data));
}

async function remove(slug: string): Promise<void> {
	await unwrapResponse(api.api.v1.brands({ slug }).delete());
}

async function removeMany(data: BulkDeleteBody): Promise<BrandBulkDeleteResult> {
	return unwrapResponse(api.api.v1.brands.bulk.post(data));
}

// ── Public API ──────────────────────────────────────

export const brandsService = {
	list,
	getBySlug,
	create,
	update,
	delete: remove,
	deleteMany: removeMany,
};
