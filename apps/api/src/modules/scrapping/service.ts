import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import * as cheerio from "cheerio";
import { logger } from "@/utils/logger";
import type { ScrapedItem } from "./model";

const BASE_URL =
	process.env.SCRAPING_REMATAZO_BASE_URL || "https://asesor.rematazo.pe/distribucion2.php";
const PHOTOS_BASE_URL = process.env.SCRAPING_REMATAZO_PHOTOS_URL || "https://rematazo.pe/fotos";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 20_000;
const IMAGE_POLITENESS_DELAY_MIN = 100;
const IMAGE_POLITENESS_DELAY_MAX = 300;

export const BROWSER_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
	"Accept-Language": "es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3",
} as const;

const HTML_ACCEPT =
	"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
export const IMAGE_ACCEPT = "image/avif,image/webp,image/apng,image/*,*/*;q=0.8";

export const SYNC_USER_AGENT = BROWSER_HEADERS["User-Agent"];

const RETRYABLE_KEYWORDS = [
	"socket",
	"econnreset",
	"etimedout",
	"econnrefused",
	"closed unexpectedly",
	"fetch failed",
] as const;

function isRetryableNetworkError(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err);
	const lower = msg.toLowerCase();
	return RETRYABLE_KEYWORDS.some((kw) => lower.includes(kw));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Queries ────────────────────────────────────────

async function fetchProductList(limit: number): Promise<ScrapedItem[]> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			const res = await fetch(BASE_URL, {
				headers: {
					...BROWSER_HEADERS,
					Accept: HTML_ACCEPT,
				},
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			});

			if (!res.ok) {
				throw createApiError({
					code: BackendErrorCodes.SERVICE_UNAVAILABLE,
					message: `Error del proveedor externo (HTTP ${res.status})`,
					metadata: { providerStatus: res.status },
				});
			}

			const html = await res.text();
			const $ = cheerio.load(html);

			const items: ScrapedItem[] = [];

			$("table tr").each((_i, el) => {
				if (items.length >= limit) return false;

				const $row = $(el);
				const $cells = $row.find("td");

				if ($cells.length < 5) return;

				const stockText = $cells.eq(2).find("p").text().trim();
				const rawStock = Number.parseInt(stockText, 10);

				if (Number.isNaN(rawStock)) {
					logger.withMetadata({ stockText }).warn("No se pudo parsear stock, se salta la fila");
					return;
				}

				const $form = $cells.eq(4).find("form");
				const providerId = $form.find('input[name="id"]').attr("value") ?? "";
				const rawName = $form.find('input[name="producto"]').attr("value") ?? "";
				const rawPrice = $form.find('input[name="precio"]').attr("value") ?? "";

				if (!providerId || !rawName) {
					logger.withMetadata({ providerId, rawName }).warn("Fila sin datos suficientes, se salta");
					return;
				}

				items.push({ providerId, rawName, rawPrice, rawStock });
			});

			return items;
		} catch (err) {
			lastError = err;
			if (attempt < MAX_RETRIES && isRetryableNetworkError(err)) {
				const jitter = Math.floor(Math.random() * 1000);
				const delay = RETRY_DELAY_MS * attempt + jitter;
				logger
					.withMetadata({ attempt, maxRetries: MAX_RETRIES, delay })
					.withError(err)
					.warn("fetchProductList failed, retrying");
				await sleep(delay);
			} else {
				throw err;
			}
		}
	}
	throw lastError;
}

/** providerId format: alphanumeric, dash, underscore, 1-64 chars. */
const PROVIDER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Verifica si existe una imagen para el producto.
 * ⚠️  Usar con limitación de concurrencia en lotes grandes para evitar rate-limits.
 */
async function fetchProductImage(providerId: string): Promise<string | null> {
	try {
		const trimmedId = providerId.trim();
		if (!trimmedId || !PROVIDER_ID_RE.test(trimmedId)) {
			// Reject anything that isn't a clean alphanumeric ID to prevent
			// path traversal or abuse via crafted providerId values.
			return null;
		}

		// Espaciado aleatorio entre requests para evitar rate-limit
		const politenessMs =
			IMAGE_POLITENESS_DELAY_MIN +
			Math.floor(Math.random() * (IMAGE_POLITENESS_DELAY_MAX - IMAGE_POLITENESS_DELAY_MIN + 1));
		await sleep(politenessMs);

		const url = `${PHOTOS_BASE_URL}/${trimmedId}.png`;

		const standardHeaders = {
			...BROWSER_HEADERS,
			Accept: IMAGE_ACCEPT,
		};

		const headRes = await fetch(url, {
			method: "HEAD",
			headers: standardHeaders,
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});

		if (headRes.ok) {
			const contentType = headRes.headers.get("content-type") ?? "";
			if (!contentType.startsWith("image/")) return null;
			return url;
		}

		if (![403, 405, 501].includes(headRes.status)) return null;

		const getRes = await fetch(url, {
			method: "GET",
			headers: {
				...standardHeaders,
				Range: "bytes=0-0",
			},
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});

		if (!getRes.ok && getRes.status !== 206) return null;

		const contentType = getRes.headers.get("content-type") ?? "";
		if (!contentType.startsWith("image/")) return null;

		return url;
	} catch (error) {
		logger
			.withMetadata({ providerId })
			.withError(error)
			.warn("Error al verificar imagen del producto");
		return null;
	}
}

// ── Public API ─────────────────────────────────────

export const scrapingService = {
	fetchProductList,
	fetchProductImage,
};
