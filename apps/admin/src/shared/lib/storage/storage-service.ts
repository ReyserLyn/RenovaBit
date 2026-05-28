// ── Types ──────────────────────────────────────────────

interface PresignResponse {
	uploadUrl: string;
	publicUrl: string;
	key: string;
	expiresAt: string;
}

// ── Errors ─────────────────────────────────────────────

export class StorageError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "StorageError";
	}
}

// ── Config ─────────────────────────────────────────────

function getApiBaseUrl(): string {
	return import.meta.env.VITE_API_URL ?? process.env.VITE_API_URL ?? "http://localhost:3001";
}

// ── Public API ─────────────────────────────────────────

/**
 * Sube un archivo de imagen a Cloudflare R2 utilizando el flujo de presigned URLs.
 *
 * 1. Solicita una URL firmada a la API (`POST /api/v1/storage/presign`)
 * 2. Sube el archivo directamente a R2 vía `PUT`
 * 3. Devuelve la `publicUrl` para usar en el create/update de la entidad
 *
 * @param file - Archivo de imagen a subir (PNG, JPG, WEBP, AVIF)
 * @returns La URL pública del archivo ya en R2 (ubicación `pending/`)
 * @throws {StorageError} Si falla la obtención de la presigned URL o el upload
 */
export async function uploadImage(file: File): Promise<string> {
	// 1. Obtener presigned URL de la API
	const presignResponse = await fetch(`${getApiBaseUrl()}/api/v1/storage/presign`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({
			filename: file.name,
			contentType: file.type,
		}),
	});

	if (!presignResponse.ok) {
		const body = await presignResponse.json().catch(() => null);
		throw new StorageError(
			body?.message ?? `Error al obtener URL de subida (${presignResponse.status})`,
			{ cause: body },
		);
	}

	const { uploadUrl, publicUrl }: PresignResponse = await presignResponse.json();

	// 2. Subir archivo directamente a R2
	const uploadResult = await fetch(uploadUrl, {
		method: "PUT",
		body: file,
		headers: { "Content-Type": file.type },
	});

	if (!uploadResult.ok) {
		throw new StorageError(`Error al subir imagen a storage (${uploadResult.status})`);
	}

	return publicUrl;
}

/**
 * Valida que un archivo cumpla con los requisitos de imagen del storage.
 * Útil para validación previa antes de llamar a `uploadImage`.
 *
 * @returns `null` si es válido, o un mensaje de error si no.
 */
export function validateImageFile(file: File, maxBytes: number = 2 * 1024 * 1024): string | null {
	const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/avif"];

	if (!allowedTypes.includes(file.type)) {
		return "Formato no soportado. Usa PNG, JPG, WEBP o AVIF.";
	}

	if (file.size > maxBytes) {
		return `La imagen no puede superar ${maxBytes / (1024 * 1024)} MB.`;
	}

	return null;
}
