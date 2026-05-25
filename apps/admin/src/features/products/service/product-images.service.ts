import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";
import type { ProductImage } from "../model";

// ── Tipos explícitos (SSOT con el API) ──────────────

export interface CreateProductImageData {
	productId: string;
	url: string;
	alt?: string;
	sortOrder?: number;
	isPrimary?: boolean;
}

export interface UpdateProductImageData {
	sortOrder?: number;
	isPrimary?: boolean;
	alt?: string;
}

// ── API Functions ────────────────────────────────────

async function listByProduct(productId: string): Promise<ProductImage[]> {
	return unwrapResponse(api.api.v1["product-images"].get({ query: { productId } }));
}

async function create(data: CreateProductImageData): Promise<ProductImage> {
	return unwrapResponse(api.api.v1["product-images"].post(data));
}

async function update(id: string, data: UpdateProductImageData): Promise<ProductImage> {
	return unwrapResponse(api.api.v1["product-images"]({ id }).patch(data));
}

async function remove(id: string): Promise<void> {
	await unwrapResponse(api.api.v1["product-images"]({ id }).delete());
}

// ── Public API ──────────────────────────────────────

export const productImagesService = {
	listByProduct,
	create,
	update,
	delete: remove,
};
