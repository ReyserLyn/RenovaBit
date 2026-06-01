import { logger } from "@/utils/logger";

/**
 * ⚠️ Migración futura: esta función es el ÚNICO punto de acoplamiento con @imgly.
 * Para cambiar a otra IA (RMBG-1.4, rembg Docker, etc.), solo modifica este archivo.
 *
 * Interfaz esperada: (input: Buffer, mimeType?: string) => Promise<Buffer>
 *
 * La importación de @imgly es lazy para evitar que su WASM bloquee
 * el inicio del worker si no es compatible con la plataforma actual.
 */

let cachedPublicPath: string | null = null;

function getImglyPublicPath(): string {
	if (cachedPublicPath) return cachedPublicPath;
	const entryUrl = import.meta.resolve("@imgly/background-removal-node");
	const distDir = new URL(".", entryUrl);
	const href = distDir.href;
	cachedPublicPath = href.endsWith("/") ? href : `${href}/`;
	return cachedPublicPath;
}

async function loadRemoveBg() {
	const mod = await import("@imgly/background-removal-node");
	return mod.removeBackground;
}

/**
 * Elimina el fondo de una imagen usando IA (@imgly/background-removal-node).
 * El modelo 'medium' balancea calidad y velocidad en CPU ARM.
 */
export async function removeBackgroundFromBuffer(
	input: Buffer,
	inputMimeType?: string,
): Promise<Buffer> {
	const removeBackground = await loadRemoveBg();

	const imageSource =
		inputMimeType != null && inputMimeType !== ""
			? new Blob([new Uint8Array(input)], { type: inputMimeType })
			: input;

	const blob = await removeBackground(imageSource, {
		publicPath: getImglyPublicPath(),
		model: "medium",
		output: {
			format: "image/png",
			quality: 1,
		},
	});

	const arrayBuffer = await blob.arrayBuffer();
	return Buffer.from(arrayBuffer);
}

/**
 * Wrapper seguro: captura errores del remove-bg y los loguea.
 * Retorna el buffer procesado o lanza error tipado.
 */
export async function removeBackgroundSafe(input: Buffer, inputMimeType?: string): Promise<Buffer> {
	try {
		return await removeBackgroundFromBuffer(input, inputMimeType);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Background removal failed";
		logger.withError(error).warn("[remove-bg] Falló la eliminación de fondo");
		throw new Error(message);
	}
}
