import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { nanoid } from "nanoid";
import { runPipeline } from "@/modules/product-processing/image-pipeline";
import { logger } from "@/utils/logger";
import { R2_BUCKET_NAME, r2Client } from "@/utils/storage/client";
import { extractKeyFromUrl, getPublicUrl, resolveEntityImage } from "@/utils/storage/helpers";

/**
 * Servicio compartido de procesamiento de imágenes para uploads admin.
 *
 * Usado por categorías, marcas y galería de productos. Centraliza el patrón:
 *
 *   1. Descargar imagen de R2 (pending/)
 *   2. Correr el pipeline de normalización (sharp + @imgly)
 *   3. Subir versión procesada a R2 (permanent)
 *   4. Borrar el pending original
 *   5. Retornar URL permanente
 *
 * Si el pipeline falla (ej. @imgly no soportado en la plataforma), hace
 * fallback a `resolveEntityImage`: mueve el raw sin procesar. La imagen
 * original nunca se pierde.
 */

export type EntityType = "category" | "brand" | "product";

export interface ProcessEntityImageInput {
	entityType: EntityType;
	entityId: string;
	/** URL pública de la imagen en `pending/`. */
	pendingUrl: string;
	/** Opciones del pipeline. Defaults razonables si se omite. */
	options?: {
		/** Activar IA de remove-bg. Default: respeta env `ENABLE_REMOVE_BG`. */
		enableRemoveBg?: boolean;
		/** Path al logo. null = sin watermark. Default: null. */
		logoPath?: string | null;
		/**
		 * Forzar canvas cuadrado 1:1. Default: true (productos, categorías).
		 * Pasar `false` para logos de marca: respeta el aspect ratio original.
		 */
		square?: boolean;
	};
	/**
	 * ID de la imagen (solo para product gallery). Default: "processed".
	 * Para category/brand siempre es "processed" (single image).
	 */
	imageId?: string;
}

export interface ProcessEntityImageResult {
	/** URL permanente para guardar en DB. */
	permanentUrl: string;
	/** SHA-256 del buffer original (antes de procesar). */
	hash: string;
	/** Key en R2 donde quedó la imagen final. */
	bucketKey: string;
	/** true = pipeline aplicó normalización. false = fallback a raw. */
	normalized: boolean;
}

const ENABLE_REMOVE_BG =
	process.env.ENABLE_REMOVE_BG !== "false" && process.env.ENABLE_REMOVE_BG !== "0";

/**
 * Procesa una imagen uploaded por admin. Ver interfaz `ProcessEntityImageInput`.
 */
export async function processEntityImage(
	input: ProcessEntityImageInput,
): Promise<ProcessEntityImageResult> {
	const { entityType, entityId, pendingUrl, imageId = "processed", options } = input;

	const sourceKey = extractKeyFromUrl(pendingUrl);
	if (!sourceKey) {
		throw createApiError({
			code: BackendErrorCodes.BAD_REQUEST,
			message: "URL de imagen inválida",
		});
	}

	// 1. Descargar de R2
	const { buffer, contentType } = await downloadFromR2(sourceKey);

	// Hash del buffer original (antes de procesar)
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(buffer);
	const hash = hasher.digest("hex");

	const destinationKey = buildDestinationKey(entityType, entityId, imageId);
	const enableRemoveBg = options?.enableRemoveBg ?? ENABLE_REMOVE_BG;
	const logoPath = options?.logoPath ?? null;
	const square = options?.square ?? true;

	let permanentUrl: string;
	let normalized = false;

	try {
		// 2. Pipeline
		const processed = await runPipeline(buffer, {
			logoPath,
			enableRemoveBg,
			inputContentType: contentType,
			square,
		});

		// 3. Upload processed
		await r2Client.send(
			new PutObjectCommand({
				Bucket: R2_BUCKET_NAME,
				Key: destinationKey,
				Body: processed,
				ContentType: "image/webp",
			}),
		);

		// 4. Borrar pending (best-effort, no bloquea el flujo)
		await r2Client
			.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: sourceKey }))
			.catch((err) => {
				logger
					.withError(err)
					.withMetadata({ key: sourceKey })
					.warn("[image-processing] No se pudo borrar pending");
			});

		permanentUrl = getPublicUrl(destinationKey);
		normalized = true;
	} catch (error) {
		// Fallback: mover raw a permanente (no perder el upload)
		logger
			.withError(error)
			.withMetadata({ entityType, entityId, sourceKey })
			.warn("[image-processing] Pipeline falló, fallback a raw upload");

		const fallbackUrl = await resolveEntityImage(pendingUrl, entityType, entityId);
		permanentUrl = fallbackUrl ?? pendingUrl;
		normalized = false;
	}

	return { permanentUrl, hash, bucketKey: destinationKey, normalized };
}

// ── Helpers ────────────────────────────────────────

/**
 * Construye la key permanente en R2.
 *
 *   category → `categories/{id}/{nanoid}.webp`   (single image, cache-safe)
 *   brand    → `brands/{id}/{nanoid}.webp`       (single image, cache-safe)
 *   product  → `products/{id}/{imageId}.webp`     (per-image, gallery)
 *
 * Para single-image entities usamos un `nanoid` único por upload. Así,
 * cuando un admin reemplaza la imagen, la URL cambia → la CDN de
 * Cloudflare no sirve la versión cacheada vieja.
 */
function buildDestinationKey(entityType: EntityType, entityId: string, imageId: string): string {
	if (entityType === "product") {
		return `products/${entityId}/${imageId}.webp`;
	}
	const uniqueId = nanoid();
	if (entityType === "category") {
		return `categories/${entityId}/${uniqueId}.webp`;
	}
	return `brands/${entityId}/${uniqueId}.webp`;
}

async function downloadFromR2(key: string): Promise<{ buffer: Buffer; contentType: string }> {
	const response = await r2Client.send(
		new GetObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: key,
		}),
	);

	if (!response.Body) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Imagen no encontrada en R2",
		});
	}

	const arrayBuffer = await response.Body.transformToByteArray();
	const buffer = Buffer.from(arrayBuffer);
	const contentType = response.ContentType ?? "image/png";

	return { buffer, contentType };
}
