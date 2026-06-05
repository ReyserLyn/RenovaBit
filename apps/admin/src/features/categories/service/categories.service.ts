import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";
import type { Category, CategoryBulkDeleteResult } from "../model";

// ── Body types derivados de Eden Treaty (SSOT con la API) ──

type CreateBody = Parameters<typeof api.api.v1.admin.categories.post>[0];
type UpdateBody = Parameters<ReturnType<typeof api.api.v1.admin.categories>["patch"]>[0];
type BulkDeleteBody = Parameters<typeof api.api.v1.admin.categories.bulk.post>[0];

// ── API Functions ────────────────────────────────────

async function list(): Promise<Category[]> {
	return unwrapResponse(api.api.v1.admin.categories.get());
}

async function getById(id: string): Promise<Category> {
	return unwrapResponse(api.api.v1.admin.categories({ id }).get());
}

async function getBySlug(slug: string): Promise<Category> {
	return unwrapResponse(api.api.v1.admin.categories.slug({ slug }).get());
}

async function create(data: CreateBody): Promise<Category> {
	return unwrapResponse(api.api.v1.admin.categories.post(data));
}

async function update(id: string, data: UpdateBody): Promise<Category> {
	return unwrapResponse(api.api.v1.admin.categories({ id }).patch(data));
}

async function remove(id: string): Promise<void> {
	await unwrapResponse(api.api.v1.admin.categories({ id }).delete());
}

async function removeMany(data: BulkDeleteBody): Promise<CategoryBulkDeleteResult> {
	return unwrapResponse(api.api.v1.admin.categories.bulk.post(data));
}

// ── Public API ──────────────────────────────────────

export const categoriesService = {
	list,
	getById,
	getBySlug,
	create,
	update,
	delete: remove,
	deleteMany: removeMany,
};
