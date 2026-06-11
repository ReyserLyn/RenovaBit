import * as cheerio from "cheerio";
import { logger } from "@/utils/logger";
import type { ScrapedItem } from "./model";

const BASE_URL =
	process.env.SCRAPING_REMATAZO_BASE_URL || "https://asesor.rematazo.pe/distribucion2.php";
const PHOTOS_BASE_URL = process.env.SCRAPING_REMATAZO_PHOTOS_URL || "https://rematazo.pe/fotos";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 20_000;

export const SYNC_USER_AGENT = "RenovabitBot/1.0";

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

// ── Queries ────────────────────────────────────────

async function fetchProductList(limit: number): Promise<ScrapedItem[]> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			const res = await fetch(BASE_URL, {
				headers: {
					"User-Agent": SYNC_USER_AGENT,
					Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
					Connection: "close",
				},
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			});

			if (!res.ok) {
				throw new Error(`HTTP ${res.status} al obtener listado de productos`);
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
				await new Promise((r) => setTimeout(r, delay));
			} else {
				throw err;
			}
		}
	}
	throw lastError;
}

/**
 * Verifica si existe una imagen para el producto.
 * ⚠️  Usar con limitación de concurrencia en lotes grandes para evitar rate-limits.
 */
async function fetchProductImage(providerId: string): Promise<string | null> {
	try {
		const trimmedId = providerId.trim();
		if (!trimmedId) return null;

		const url = `${PHOTOS_BASE_URL}/${trimmedId}.png`;
		const headRes = await fetch(url, {
			method: "HEAD",
			headers: { "User-Agent": SYNC_USER_AGENT },
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
				"User-Agent": SYNC_USER_AGENT,
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
