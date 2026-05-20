import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia, t } from "elysia";
import { ErrorResponse, ProductImageModel } from "./model";
import { ProductImageService } from "./service";

export const productImagesRoute = new Elysia({ prefix: "/product-images" })
	// ── List by product ─────────────────────────────
	.get(
		"/:productId",
		async ({ params: { productId } }) => {
			return ProductImageService.listByProduct(productId);
		},
		{
			params: ProductImageModel.productIdParams,
			response: {
				200: ProductImageModel.imageListResponse,
			},
			detail: { summary: "Listar imágenes de un producto", tags: ["Product Images"] },
		},
	)

	// ── Create ──────────────────────────────────────
	.post("/", ({ body }) => ProductImageService.create(body), {
		isAdmin: true,
		body: ProductImageModel.createBody,
		response: {
			201: ProductImageModel.imageResponse,
			400: ErrorResponse,
			401: ErrorResponse,
			403: ErrorResponse,
			404: ErrorResponse,
		},
		detail: { summary: "Agregar imagen a producto", tags: ["Product Images"] },
	})

	// ── Update ──────────────────────────────────────
	.patch("/:id", ({ params: { id }, body }) => ProductImageService.update(id, body), {
		isAdmin: true,
		params: ProductImageModel.idParams,
		body: ProductImageModel.updateBody,
		response: {
			200: ProductImageModel.imageResponse,
			400: ErrorResponse,
			401: ErrorResponse,
			403: ErrorResponse,
			404: ErrorResponse,
		},
		detail: { summary: "Actualizar imagen", tags: ["Product Images"] },
	})

	// ── Delete ──────────────────────────────────────
	.delete(
		"/:id",
		async ({ params: { id }, set }) => {
			await ProductImageService.delete(id);
			set.status = 204;
		},
		{
			isAdmin: true,
			params: ProductImageModel.idParams,
			response: {
				204: t.Undefined(),
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Eliminar imagen", tags: ["Product Images"] },
		},
	);
