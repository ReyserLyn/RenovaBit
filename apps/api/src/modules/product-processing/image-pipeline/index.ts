import path from "node:path";
import { compositeLogo } from "./composite-logo";
import {
	getContentRatio,
	hasSignificantTransparency,
	normalizeToSquareTransparent,
	replaceDarkBackgroundWithTransparent,
	trimToContent,
} from "./normalize";
import { removeBackgroundSafe } from "./remove-bg";
import { toWebp } from "./to-webp";

// ── Config ────────────────────────────────────────

const MIN_CONTENT_RATIO = 0.06;
const DEFAULT_LOGO_POSITION = "top-right" as const;

/** Path al SVG del logo de RenovaBit. Usado como watermark. */
export const LOGO_PATH = path.join(
	import.meta.dir,
	"..",
	"..",
	"..",
	"assets",
	"logo-stacked-light.svg",
);

export interface PipelineOptions {
	/** Ruta al archivo del logo SVG/PNG. null = no aplicar watermark. */
	logoPath: string | null;
	/** Posición del logo. Default: "top-right" */
	logoPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
	/** Activar eliminación de fondo por IA. Default: false (solo fallback fondo oscuro) */
	enableRemoveBg?: boolean;
	/** MIME type de la imagen de entrada (para @imgly). */
	inputContentType?: string;
}

// ── Pipeline ──────────────────────────────────────

/**
 * Pipeline completo de procesamiento de imagen de producto:
 *
 *   1. Detectar transparencia existente
 *   2. Remove BG (IA) o fallback fondo oscuro → transparente
 *   3. Trim (recortar bordes)
 *   4. Normalizar a cuadrado 1:1 con márgenes
 *   5. Logo/watermark
 *   6. Convertir a WebP
 *
 *   ⚠️  Este pipeline es CPU-intensivo. Se ejecuta inline durante el sync.
 */
export async function runPipeline(input: Buffer, options: PipelineOptions): Promise<Buffer> {
	const {
		logoPath,
		logoPosition = DEFAULT_LOGO_POSITION,
		enableRemoveBg = false,
		inputContentType,
	} = options;

	let toNormalize: Buffer;

	// 1. ¿Ya tiene fondo transparente?
	if (await hasSignificantTransparency(input)) {
		try {
			toNormalize = await trimToContent(input);
			if (toNormalize.length === 0) toNormalize = input;
		} catch {
			toNormalize = input;
		}
	}
	// 2. Remove BG desactivado → fallback fondo oscuro
	else if (!enableRemoveBg) {
		const withTransparentBg = await replaceDarkBackgroundWithTransparent(input);
		try {
			toNormalize = await trimToContent(withTransparentBg);
			if (toNormalize.length === 0) toNormalize = withTransparentBg;
		} catch {
			toNormalize = withTransparentBg;
		}
	}
	// 3. Remove BG por IA
	else {
		const withoutBg = await removeBackgroundSafe(input, inputContentType);
		const contentRatio = await getContentRatio(withoutBg);

		// Si la IA eliminó el objeto (obj oscuro sobre fondo oscuro) → fallback
		if (contentRatio < MIN_CONTENT_RATIO) {
			const withTransparentBg = await replaceDarkBackgroundWithTransparent(input);
			try {
				toNormalize = await trimToContent(withTransparentBg);
				if (toNormalize.length === 0) toNormalize = withTransparentBg;
			} catch {
				toNormalize = withTransparentBg;
			}
		} else {
			try {
				toNormalize = await trimToContent(withoutBg);
				if (toNormalize.length === 0) toNormalize = withoutBg;
			} catch {
				toNormalize = withoutBg;
			}
		}
	}

	// 4. Normalizar
	const normalized = await normalizeToSquareTransparent(toNormalize);

	// 5. Logo (skip si logoPath es null)
	const withLogo =
		logoPath === null ? normalized : await compositeLogo(normalized, logoPath, logoPosition);

	// 6. WebP
	return toWebp(withLogo);
}
