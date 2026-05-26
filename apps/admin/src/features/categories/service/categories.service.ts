import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";
import type { BreadcrumbItem, Category, CategoryBulkDeleteResult } from "../model";

// ── Body types derivados de Eden Treaty (SSOT con la API) ──

type CreateBody = Parameters<typeof api.api.v1.categories.post>[0];
type UpdateBody = Parameters<ReturnType<typeof api.api.v1.categories>["patch"]>[0];
type BulkDeleteBody = Parameters<typeof api.api.v1.categories.bulk.post>[0];

// ── API Functions ────────────────────────────────────

async function list(): Promise<Category[]> {
	return unwrapResponse(api.api.v1.categories.get());
}

// GET /tree no se usa desde el admin. Las tienda pública lo consume directamente.
// El admin construye el árbol client-side con buildCategoryTree() desde la lista plana.

async function getById(id: string): Promise<Category> {
	return unwrapResponse(api.api.v1.categories({ id }).get());
}

async function getBySlug(slug: string): Promise<Category> {
	return unwrapResponse(api.api.v1.categories.slug({ slug }).get());
}

async function getBreadcrumb(slug: string): Promise<BreadcrumbItem[]> {
	return unwrapResponse(api.api.v1.categories.breadcrumb({ slug }).get());
}

async function create(data: CreateBody): Promise<Category> {
	return unwrapResponse(api.api.v1.categories.post(data));
}

async function update(id: string, data: UpdateBody): Promise<Category> {
	return unwrapResponse(api.api.v1.categories({ id }).patch(data));
}

async function remove(id: string): Promise<void> {
	await unwrapResponse(api.api.v1.categories({ id }).delete());
}

async function removeMany(data: BulkDeleteBody): Promise<CategoryBulkDeleteResult> {
	return unwrapResponse(api.api.v1.categories.bulk.post(data));
}

// ── Public API ──────────────────────────────────────

export const categoriesService = {
	list,
	getById,
	getBySlug,
	getBreadcrumb,
	create,
	update,
	delete: remove,
	deleteMany: removeMany,
};
