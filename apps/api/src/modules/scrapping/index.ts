import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia, t } from "elysia";
import { ScrapingModel } from "./model";
import { PHOTOS_BASE_URL, scrapingService } from "./service";

export const scrapingController = new Elysia({ prefix: "/scraping" }).post(
	"/run",
	async ({ query: { limit } }) => {
		const raw = limit ?? "50";
		const parsed = Number.parseInt(raw, 10);

		if (Number.isNaN(parsed) || parsed < 1 || parsed > 2000) {
			throw createApiError({
				code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
				message: "El parámetro 'limit' debe ser un número entero entre 1 y 2000",
				logLevel: "info",
				doNotLog: true,
			});
		}

		console.log(`[i] Scraping manual iniciado con limit=${parsed}...`);
		const items = await scrapingService.fetchProductList(parsed);
		console.log(`[+] Scraping completado: ${items.length} items obtenidos`);

		for (const item of items) {
			const imageUrl = `${PHOTOS_BASE_URL}/${item.providerId}.png`;
			console.log(`[i] ${item.providerId}: ${imageUrl}`);
		}

		return {
			success: true,
			count: items.length,
			items,
		};
	},
	{
		isAdmin: true,
		query: ScrapingModel.runQuery,
		response: {
			200: t.Object({
				success: t.Boolean(),
				count: t.Integer(),
				items: ScrapingModel.scrapedItemList,
			}),
		},
		detail: {
			tags: ["Scraping"],
			summary: "Ejecutar scraping manual",
			description: "Obtiene el listado de productos desde el proveedor externo (admin only)",
		},
	},
);
