import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const LOGO_SIZE_RATIO = 0.18;
const PADDING_RATIO = 0.03;
const LOGO_OPACITY = 0.4;
const SVG_DENSITY = 288;

export type LogoPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

function isSvgBuffer(buffer: Buffer): boolean {
	const start = buffer.subarray(0, 1024).toString("utf8").trimStart();
	return start.startsWith("<svg") || start.startsWith("<?xml");
}

async function compositeWithLogoBuffer(
	input: Buffer,
	logoBuffer: Buffer,
	position: LogoPosition,
): Promise<Buffer> {
	const image = sharp(input);
	const meta = await image.metadata();
	const width = meta.width ?? 0;
	const height = meta.height ?? 0;

	if (width <= 0 || height <= 0) {
		return input;
	}

	const side = Math.max(width, height);
	const logoSize = Math.max(32, Math.floor(side * LOGO_SIZE_RATIO));
	const padding = Math.floor(side * PADDING_RATIO);

	const sharpLogo = isSvgBuffer(logoBuffer)
		? sharp(logoBuffer, { density: SVG_DENSITY })
		: sharp(logoBuffer);

	const resized = await sharpLogo
		.resize(logoSize, logoSize, { fit: "inside", kernel: "lanczos3" })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	const { data, info } = resized;
	for (let i = 3; i < data.length; i += 4) {
		data[i] = Math.round((data[i] ?? 0) * LOGO_OPACITY);
	}

	const logoPng = await sharp(data, {
		raw: { width: info.width, height: info.height, channels: 4 },
	})
		.png()
		.toBuffer();

	const lw = info.width;
	const lh = info.height;
	const isTop = position === "top-left" || position === "top-right";
	const isLeft = position === "top-left" || position === "bottom-left";
	const left = isLeft ? padding : width - lw - padding;
	const top = isTop ? padding : height - lh - padding;

	return sharp(input)
		.composite([
			{
				input: logoPng,
				left: Math.max(0, left),
				top: Math.max(0, top),
			},
		])
		.png()
		.toBuffer();
}

/**
 * Aplica el logo como marca de agua en la posición especificada.
 * Si el archivo de logo no existe, retorna la imagen sin modificar.
 */
export async function compositeLogo(
	input: Buffer,
	logoPath: string,
	position: LogoPosition = "top-right",
): Promise<Buffer> {
	if (!logoPath.trim() || !existsSync(logoPath)) {
		return input;
	}
	const logoBuffer = await readFile(logoPath);
	return compositeWithLogoBuffer(input, logoBuffer, position);
}
