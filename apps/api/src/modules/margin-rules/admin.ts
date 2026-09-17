/**
 * Margin rules admin routes — CRUD for pricing tiers.
 * Prefix: /api/v1/admin/margin-rules
 *
 * Rows carry `customerPct` for the `customer` role. Admin never has rules.
 *
 * Delegates to MarginRulesService for DB operations and overlap detection.
 */
import { Elysia, t } from "elysia";
import { AuthMacros } from "@/modules/auth";
import { notFound } from "@/utils/api-helpers";
import {
	CreateMarginRuleBody,
	ErrorResponse,
	MarginRuleIdParams,
	MarginRuleResponse,
	UpdateMarginRuleBody,
} from "./model";
import { MarginRulesService } from "./service";

export const adminMarginRulesRoute = new Elysia({ prefix: "/margin-rules" })
	.use(AuthMacros)
	// ── List ──────────────────────────────────────
	.get("/", async () => MarginRulesService.list(), {
		isAdmin: true,
		response: {
			200: t.Array(MarginRuleResponse),
			401: ErrorResponse,
			403: ErrorResponse,
		},
		detail: { summary: "Listar reglas de margen", tags: ["Margin"] },
	})

	// ── Create ────────────────────────────────────
	.post(
		"/",
		async ({ body, set }) => {
			set.status = 201;
			return MarginRulesService.create(body);
		},
		{
			isAdmin: true,
			body: CreateMarginRuleBody,
			response: {
				201: MarginRuleResponse,
				400: ErrorResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				409: ErrorResponse,
			},
			detail: { summary: "Crear regla de margen", tags: ["Margin"] },
		},
	)

	// ── Update ────────────────────────────────────
	.put("/:id", async ({ params: { id }, body }) => MarginRulesService.update(id, body), {
		isAdmin: true,
		params: MarginRuleIdParams,
		body: UpdateMarginRuleBody,
		response: {
			200: MarginRuleResponse,
			400: ErrorResponse,
			401: ErrorResponse,
			403: ErrorResponse,
			404: ErrorResponse,
			409: ErrorResponse,
		},
		detail: { summary: "Actualizar regla de margen", tags: ["Margin"] },
	})

	// ── Delete ────────────────────────────────────
	.delete(
		"/:id",
		async ({ params: { id }, set }) => {
			const deleted = await MarginRulesService.delete(id);
			if (!deleted) throw notFound("Regla de margen no encontrada");
			set.status = 204;
		},
		{
			isAdmin: true,
			params: MarginRuleIdParams,
			response: {
				204: t.Undefined(),
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Eliminar regla de margen", tags: ["Margin"] },
		},
	);
