import sharp from "sharp";

/** Fondo transparente para canvas y márgenes. */
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
/** Margen en proporción al lado (5% por cada borde). */
const MARGIN_RATIO = 0.05;
/** Umbral para "fondo oscuro": píxeles con R,G,B por debajo se reemplazan por transparente. */
const DARK_BG_THRESHOLD = 55;
/** Proporción de píxeles transparentes para considerar que la imagen ya tiene fondo transparente. */
const TRANSPARENT_PIXEL_RATIO_THRESHOLD = 0.15;
const ALPHA_TRANSPARENT_THRESHOLD = 200;

// ── Transparencia ────────────────────────────────

/**
 * True si la imagen ya tiene transparencia significativa (ej. PNG con fondo recortado).
 */
export async function hasSignificantTransparency(buffer: Buffer): Promise<boolean> {
	const { data, info } = await sharp(buffer)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const total = info.width * info.height;
	if (total === 0) return false;
	let transparentCount = 0;
	for (let i = 3; i < data.length; i += 4) {
		if ((data[i] ?? 255) < ALPHA_TRANSPARENT_THRESHOLD) transparentCount += 1;
	}
	return transparentCount / total >= TRANSPARENT_PIXEL_RATIO_THRESHOLD;
}

/**
 * Proporción de píxeles con alpha > 128 (contenido no transparente).
 * Si es muy baja, remove-bg probablemente eliminó el objeto.
 */
export async function getContentRatio(buffer: Buffer): Promise<number> {
	const { data, info } = await sharp(buffer)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const total = info.width * info.height;
	let withContent = 0;
	for (let i = 3; i < data.length; i += 4) {
		if ((data[i] ?? 0) > 128) withContent += 1;
	}
	return total > 0 ? withContent / total : 0;
}

// ── Fallback fondo oscuro ────────────────────────

/**
 * Fallback cuando remove-bg falla (objeto oscuro sobre fondo oscuro):
 * reemplaza fondo oscuro por transparente sin tocar el objeto.
 */
export async function replaceDarkBackgroundWithTransparent(input: Buffer): Promise<Buffer> {
	const { data, info } = await sharp(input)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const t = DARK_BG_THRESHOLD;
	for (let i = 0; i < data.length; i += 4) {
		const r = data[i] ?? 0;
		const g = data[i + 1] ?? 0;
		const b = data[i + 2] ?? 0;
		if (r <= t && g <= t && b <= t) {
			data[i + 3] = 0;
		} else {
			data[i + 3] = 255;
		}
	}
	return sharp(data, {
		raw: { width: info.width, height: info.height, channels: 4 },
	})
		.png()
		.toBuffer();
}

// ── Trim ─────────────────────────────────────────

/**
 * Recorta bordes transparentes o del mismo color (detecta el "objeto").
 */
export async function trimToContent(input: Buffer): Promise<Buffer> {
	return sharp(input).trim({ threshold: 15 }).png().toBuffer();
}

// ── Normalize ────────────────────────────────────

/**
 * Normaliza la imagen aplicando margen transparente del 5% en cada borde.
 *
 *   square: true  → fuerza canvas 1:1 (lado mayor), contenido centrado con `contain`.
 *   square: false → respeta el aspect ratio original; solo agrega el margen.
 *
 * Para logos de marca (HP, MSI, etc.) usar `square: false` para que el
 * aspect ratio original no se distorsione con padding transparente.
 */
export async function normalizeToSquareTransparent(
	input: Buffer,
	options: { square?: boolean } = {},
): Promise<Buffer> {
	const { square = true } = options;
	const image = sharp(input);
	const meta = await image.metadata();
	const width = meta.width ?? 0;
	const height = meta.height ?? 0;

	if (width <= 0 || height <= 0) {
		return input;
	}

	let base: Buffer;
	if (square) {
		// Forzar 1:1: el lado mayor define el canvas, el contenido entra con contain.
		const side = Math.max(width, height);
		base = await sharp(input)
			.resize(side, side, {
				fit: "contain",
				background: TRANSPARENT,
				position: "center",
			})
			.png()
			.toBuffer();
	} else {
		// Respetar aspect ratio original. Solo convertimos a PNG para consistencia
		// con la operación `.extend` que viene después.
		base = await sharp(input).png().toBuffer();
	}

	// 5% de margen sobre el lado mayor (funciona en ambos casos).
	const marginRef = Math.max(width, height);
	const margin = Math.max(8, Math.floor(marginRef * MARGIN_RATIO));

	return sharp(base)
		.extend({
			top: margin,
			bottom: margin,
			left: margin,
			right: margin,
			background: TRANSPARENT,
		})
		.png()
		.toBuffer();
}
