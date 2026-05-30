import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia } from "elysia";
import { enqueueManualScraping } from "@/jobs/scraping.queue";
import { auth } from "@/utils/auth/auth";
import { ScrapingModel } from "./model";

export const scrapingController = new Elysia({ prefix: "/scraping" }).post(
	"/run",
	async ({ query: { limit }, request }) => {
		const parsed = Number.parseInt(limit ?? "300", 10);

		if (Number.isNaN(parsed) || parsed < 1 || parsed > 2000) {
			throw createApiError({
				code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
				message: "El parámetro 'limit' debe ser un número entero entre 1 y 2000",
				logLevel: "info",
				doNotLog: true,
			});
		}

		const session = await auth.api.getSession({ headers: request.headers });
		const job = await enqueueManualScraping(parsed, session?.user.id);

		return {
			success: true,
			jobId: job.id ?? "",
			message: `Scraping encolado con limit=${parsed}`,
		};
	},
	{
		isAdmin: true,
		query: ScrapingModel.runQuery,
		response: {
			200: ScrapingModel.runResponse,
		},
		detail: {
			tags: ["Scraping"],
			summary: "Ejecutar scraping manual",
			description: "Encola un job de scraping para procesamiento en background (admin only)",
		},
	},
);
