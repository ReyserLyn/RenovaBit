import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";
import type {
	CreateProductValues,
	Product,
	ProductBulkDeleteResult,
	UpdateProductValues,
} from "../model";

// ── API Functions ────────────────────────────────────

async function list(): Promise<Product[]> {
	return unwrapResponse(api.api.v1.products.get());
}

async function getById(id: string): Promise<Product> {
	return unwrapResponse(api.api.v1.products({ id }).get());
}

async function getBySlug(slug: string): Promise<Product> {
	return unwrapResponse(api.api.v1.products.slug({ slug }).get());
}

async function create(data: CreateProductValues): Promise<Product> {
	return unwrapResponse(api.api.v1.products.post(data));
}

async function update(id: string, data: UpdateProductValues): Promise<Product> {
	return unwrapResponse(api.api.v1.products({ id }).patch(data));
}

async function remove(id: string): Promise<void> {
	await unwrapResponse(api.api.v1.products({ id }).delete());
}

async function removeMany(data: { ids: string[] }): Promise<ProductBulkDeleteResult> {
	return unwrapResponse(api.api.v1.products.bulk.post(data));
}

// ── Public API ──────────────────────────────────────

export const productsService = {
	list,
	getById,
	getBySlug,
	create,
	update,
	delete: remove,
	deleteMany: removeMany,
};
