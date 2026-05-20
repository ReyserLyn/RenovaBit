import {
	CopyObjectCommand,
	DeleteObjectCommand,
	DeleteObjectsCommand,
	ListObjectsV2Command,
	PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "@/utils/logger";
import { R2_BUCKET_NAME, R2_PUBLIC_URL, r2Client } from "./client";

// ── Constants ──────────────────────────────────────

const PRESIGN_EXPIRY_SECONDS = 300; // 5 minutos

/**
 * Content-Type → extensión segura.
 * Útil cuando el cliente reporta un content-type distinto al esperado.
 */
const EXT_MAP: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/avif": "avif",
};

// ── Key helpers ────────────────────────────────────

/** Genera una key única para un upload pendiente. */
export function generatePendingKey(ext: string): string {
	return `pending/${crypto.randomUUID()}.${ext}`;
}

/** Construye una URL pública a partir de una key de R2. */
export function getPublicUrl(key: string): string {
	return `${R2_PUBLIC_URL}/${key}`;
}

/** Determina si una URL apunta al prefijo pending/. */
export function isPendingUrl(url: string): boolean {
	return url.includes("/pending/");
}

/** Extrae la key de R2 desde una URL pública. Retorna null si no pertenece a nuestro bucket. */
export function extractKeyFromUrl(url: string): string | null {
	try {
		const parsed = new URL(url);
		if (!url.startsWith(R2_PUBLIC_URL)) return null;
		return parsed.pathname.slice(1) || null;
	} catch {
		return null;
	}
}

// ── Presigned URL ──────────────────────────────────

/**
 * Genera una presigned URL para que el cliente suba directamente a R2.
 * El archivo se sube a pending/ y se mueve a su ubicación permanente
 * cuando la entidad se crea/actualiza.
 */
export async function generatePresignUrl(
	filename: string,
	contentType: string,
): Promise<{
	uploadUrl: string;
	publicUrl: string;
	key: string;
	expiresAt: string;
}> {
	const rawExt = filename.split(".").pop()?.toLowerCase() || "bin";
	const ext = EXT_MAP[contentType] || rawExt;
	const key = generatePendingKey(ext);

	const command = new PutObjectCommand({
		Bucket: R2_BUCKET_NAME,
		Key: key,
		ContentType: contentType,
	});

	const uploadUrl = await getSignedUrl(r2Client, command, {
		expiresIn: PRESIGN_EXPIRY_SECONDS,
	});

	return {
		uploadUrl,
		publicUrl: getPublicUrl(key),
		key,
		expiresAt: new Date(Date.now() + PRESIGN_EXPIRY_SECONDS * 1000).toISOString(),
	};
}

// ── Object operations ──────────────────────────────

/**
 * Mueve un objeto de una key a otra (copy + delete, S3 no tiene move nativo).
 * Preserva Content-Type y metadata.
 */
export async function moveObject(sourceKey: string, destinationKey: string): Promise<void> {
	await r2Client.send(
		new CopyObjectCommand({
			Bucket: R2_BUCKET_NAME,
			CopySource: `${R2_BUCKET_NAME}/${sourceKey}`,
			Key: destinationKey,
			MetadataDirective: "COPY",
		}),
	);

	await r2Client.send(
		new DeleteObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: sourceKey,
		}),
	);
}

/** Elimina un objeto individual de R2. */
export async function deleteObject(key: string): Promise<void> {
	await r2Client.send(
		new DeleteObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: key,
		}),
	);
}

/**
 * Elimina todos los objetos bajo un prefijo (carpeta virtual).
 * Maneja paginación automáticamente.
 * Retorna la cantidad de objetos eliminados.
 */
export async function deleteObjectsByPrefix(prefix: string): Promise<number> {
	let deletedCount = 0;
	let continuationToken: string | undefined;

	while (true) {
		const listed = await r2Client.send(
			new ListObjectsV2Command({
				Bucket: R2_BUCKET_NAME,
				Prefix: prefix,
				ContinuationToken: continuationToken,
			}),
		);

		const keys = listed.Contents?.map((o) => o.Key).filter((k): k is string => !!k);

		if (keys && keys.length > 0) {
			await r2Client.send(
				new DeleteObjectsCommand({
					Bucket: R2_BUCKET_NAME,
					Delete: {
						Objects: keys.map((Key) => ({ Key })),
						Quiet: true,
					},
				}),
			);
			deletedCount += keys.length;
		}

		if (!listed.IsTruncated) break;
		continuationToken = listed.NextContinuationToken;
	}

	return deletedCount;
}

// ── Garbage collection ─────────────────────────────

/**
 * Elimina objetos en pending/ que tengan más de maxAgeHours horas.
 * Retorna la cantidad de objetos eliminados.
 */
export async function cleanupPendingObjects(maxAgeHours = 24): Promise<number> {
	const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
	let deletedCount = 0;
	let continuationToken: string | undefined;

	while (true) {
		const listed = await r2Client.send(
			new ListObjectsV2Command({
				Bucket: R2_BUCKET_NAME,
				Prefix: "pending/",
				ContinuationToken: continuationToken,
			}),
		);

		const staleKeys =
			listed.Contents?.filter((o) => {
				if (!o.LastModified || !o.Key) return false;
				return o.LastModified < cutoff;
			}).map((o) => o.Key) ?? [];

		if (staleKeys.length > 0) {
			await r2Client.send(
				new DeleteObjectsCommand({
					Bucket: R2_BUCKET_NAME,
					Delete: {
						Objects: staleKeys.map((Key) => ({ Key })),
						Quiet: true,
					},
				}),
			);
			deletedCount += staleKeys.length;
		}

		if (!listed.IsTruncated) break;
		continuationToken = listed.NextContinuationToken;
	}

	if (deletedCount > 0) {
		logger.info(`[R2] GC eliminó ${deletedCount} objetos pendientes`);
	}

	return deletedCount;
}

// ── Entity image helpers ────────────────────────────

/**
 * Resuelve una imagen pendiente a su ubicación permanente.
 * - Si no es pending, la retorna tal cual.
 * - Si es pending, la mueve a `{entity}/{entityId}/image.{ext}`.
 * - Retorna la nueva URL pública o null si falla (no bloqueante).
 */
export async function resolveEntityImage(
	imageUrl: string | null | undefined,
	entity: string,
	entityId: string,
): Promise<string | null> {
	if (!imageUrl) return null;
	if (!isPendingUrl(imageUrl)) return imageUrl;

	const key = extractKeyFromUrl(imageUrl);
	if (!key) return imageUrl;

	const ext = key.split(".").pop() || "jpg";
	const permanentKey = `${entity}/${entityId}/image.${ext}`;

	try {
		await moveObject(key, permanentKey);
		return getPublicUrl(permanentKey);
	} catch (error) {
		logger.withError(error).warn(`[R2] No se pudo resolver imagen de ${entity}/${entityId}`);
		return imageUrl; // mantener URL original para no perder referencia
	}
}

/**
 * Elimina una imagen permanente de R2.
 * Ignora URLs pendientes (se limpian con GC).
 */
export async function deleteEntityImage(imageUrl: string | null | undefined): Promise<void> {
	if (!imageUrl || isPendingUrl(imageUrl)) return;
	const key = extractKeyFromUrl(imageUrl);
	if (!key) return;

	try {
		await deleteObject(key);
	} catch (error) {
		logger.withError(error).warn(`[R2] No se pudo eliminar imagen: ${key}`);
	}
}

/**
 * Elimina todas las imágenes de una entidad (carpeta completa).
 */
export async function deleteEntityFolder(entity: string, entityId: string): Promise<void> {
	try {
		await deleteObjectsByPrefix(`${entity}/${entityId}/`);
	} catch (error) {
		logger.withError(error).warn(`[R2] No se pudo eliminar carpeta de ${entity}/${entityId}`);
	}
}
