import { PutObjectCommand } from "@aws-sdk/client-s3";
import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { productImages, products } from "@renovabit/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { LOGO_PATH, runPipeline } from "@/modules/product-processing/image-pipeline";
import { BROWSER_HEADERS, IMAGE_ACCEPT } from "@/modules/scrapping/service";
import { logger } from "@/utils/logger";
import { R2_BUCKET_NAME, r2Client } from "@/utils/storage/client";
import { getPublicUrl } from "@/utils/storage/helpers";

// ── Config ────────────────────────────────────────

const ENABLE_REMOVE_BG =
	process.env.ENABLE_REMOVE_BG !== "false" && process.env.ENABLE_REMOVE_BG !== "0";
const FETCH_TIMEOUT_MS = 30_000;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

// ── Public API ─────────────────────────────────────

export interface ProcessImageInput {
	productId: string;
	imageUrl: string;
}

export interface ProcessImageResult {
	productId: string;
	url: string;
	hash: string;
}

/**
 * Procesa una imagen individual: descarga → pipeline → R2 → DB.
 * Usado inline en createNewProduct y desde el worker BullMQ.
 */
export async function processProductImage(input: ProcessImageInput): Promise<ProcessImageResult> {
	const { productId, imageUrl } = input;

	logger.withMetadata({ productId, imageUrl }).info("[image] Iniciando procesamiento");

	// 1. Descargar
	const { buffer, contentType } = await fetchImageBuffer(imageUrl);

	// Hash del contenido original para detectar cambios futuros
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(buffer);
	const hash = hasher.digest("hex");

	// 2. Pipeline
	const processed = await runPipeline(buffer, {
		logoPath: LOGO_PATH,
		logoPosition: "top-right",
		enableRemoveBg: ENABLE_REMOVE_BG,
		inputContentType: contentType,
	});

	// 3. Subir a R2. Usamos un `nanoid` único en la key para que cada
	// re-scrape con imagen distinta genere una URL nueva. Así invalidamos
	// la cache de Cloudflare sin tener que purgarla explícitamente.
	const key = `products/${productId}/${nanoid()}.webp`;
	await r2Client.send(
		new PutObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: key,
			Body: processed,
			ContentType: "image/webp",
		}),
	);

	const publicUrl = getPublicUrl(key);

	// 4. Guardar en DB: la imagen scrapeada es siempre la primaria del producto
	await db
		.update(productImages)
		.set({ isPrimary: false })
		.where(eq(productImages.productId, productId));

	await db
		.delete(productImages)
		.where(and(eq(productImages.productId, productId), eq(productImages.url, publicUrl)));

	await db.insert(productImages).values({
		productId,
		url: publicUrl,
		alt: null,
		sortOrder: 0,
		isPrimary: true,
	});

	// 5. Quitar "Sin imagen" de review
	await removeImageReviewReason(productId);

	logger.withMetadata({ productId, publicUrl }).info("[image] Procesamiento completado");

	return { productId, url: publicUrl, hash };
}

// ── Helpers ────────────────────────────────────────

async function fetchImageBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
	const res = await fetch(url, {
		headers: {
			...BROWSER_HEADERS,
			Accept: IMAGE_ACCEPT,
		},
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	});

	if (!res.ok) {
		throw createApiError({
			code: BackendErrorCodes.SERVICE_UNAVAILABLE,
			message: `Error al descargar imagen: HTTP ${res.status}`,
			metadata: { imageStatus: res.status },
		});
	}

	const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/png";
	if (!contentType.startsWith("image/")) {
		throw createApiError({
			code: BackendErrorCodes.BAD_REQUEST,
			message: `Tipo de contenido inválido: ${contentType}`,
			metadata: { contentType },
		});
	}

	const arrayBuffer = await res.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	if (buffer.length > MAX_INPUT_BYTES) {
		throw createApiError({
			code: BackendErrorCodes.BAD_REQUEST,
			message: `Imagen demasiado grande: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`,
			metadata: { maxBytes: MAX_INPUT_BYTES, actualBytes: buffer.length },
		});
	}

	return { buffer, contentType };
}

export async function removeImageReviewReason(productId: string): Promise<void> {
	const [product] = await db
		.select({ needsReview: products.needsReview, reviewReason: products.reviewReason })
		.from(products)
		.where(eq(products.id, productId))
		.limit(1);

	if (!product?.needsReview || !product.reviewReason) return;

	const reasons = product.reviewReason.split(";").map((r) => r.trim());
	const remaining = reasons.filter((r) => r !== "Sin imagen");

	if (remaining.length === reasons.length) return;

	await db
		.update(products)
		.set({
			needsReview: remaining.length > 0,
			reviewReason: remaining.length > 0 ? remaining.join("; ") : null,
		})
		.where(eq(products.id, productId));
}
