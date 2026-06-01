import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia } from "elysia";
import { enqueueManualScraping } from "@/jobs/scraping.queue";
import { auth } from "@/utils/auth/auth";
import { BlacklistModel, ErrorResponse } from "./blacklist.model";
import { BlacklistService } from "./blacklist.service";
import { ScrapingModel } from "./model";

export const scrapingController = new Elysia({ prefix: "/scraping" })
	// ── Run sync ────────────────────────────────────
	.post(
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
	)

	// ═════════════════════════════════════════════════
	//  BLACKLIST
	// ═════════════════════════════════════════════════

	// ── List ────────────────────────────────────────
	.get(
		"/blacklist",
		async ({ query }) => {
			return BlacklistService.list(query.source);
		},
		{
			isAdmin: true,
			query: BlacklistModel.listQuery,
			response: {
				200: BlacklistModel.listResponse,
				401: ErrorResponse,
				403: ErrorResponse,
			},
			detail: {
				tags: ["Scraping"],
				summary: "Listar entradas de la lista negra",
				description: "Devuelve todos los provider IDs bloqueados. Filtrable por source.",
			},
		},
	)

	// ── Add ─────────────────────────────────────────
	.post(
		"/blacklist",
		async ({ body, request }) => {
			const session = await auth.api.getSession({ headers: request.headers });
			return BlacklistService.add(body, session?.user.id ?? "");
		},
		{
			isAdmin: true,
			body: BlacklistModel.addBody,
			response: {
				200: BlacklistModel.addResponse,
				400: ErrorResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				409: ErrorResponse,
			},
			detail: {
				tags: ["Scraping"],
				summary: "Añadir provider ID a la lista negra",
				description:
					"Bloquea un ID de proveedor. Si existe un producto vinculado, lo elimina del catálogo. El ID bloqueado no volverá a importarse en futuros syncs.",
			},
		},
	)

	// ── Remove ──────────────────────────────────────
	.delete(
		"/blacklist",
		async ({ body }) => {
			const deleted = await BlacklistService.remove(body);
			return { deleted: deleted !== null };
		},
		{
			isAdmin: true,
			body: BlacklistModel.removeBody,
			response: {
				200: BlacklistModel.removeResponse,
				401: ErrorResponse,
				403: ErrorResponse,
			},
			detail: {
				tags: ["Scraping"],
				summary: "Quitar provider ID de la lista negra",
				description:
					"Elimina un ID de la lista negra. El proveedor volverá a poder sincronizarse en el próximo sync.",
			},
		},
	);
