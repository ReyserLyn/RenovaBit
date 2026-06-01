import sharp from "sharp";

const WEBP_QUALITY = 100;
const WEBP_ALPHA_QUALITY = 100;

export async function toWebp(input: Buffer): Promise<Buffer> {
	return sharp(input).webp({ quality: WEBP_QUALITY, alphaQuality: WEBP_ALPHA_QUALITY }).toBuffer();
}
