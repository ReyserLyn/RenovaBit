/**
 * Margin rules admin routes — CRUD for pricing tiers.
 * Prefix: /api/v1/admin/margin-rules
 *
 * Delegates to MarginRulesService for DB operations.
 */
import { Elysia, t } from "elysia";
import { MarginRulesService } from "@/modules/margin-rules/service";
import { notFound } from "@/utils/api-helpers";

const ErrorResponse = t.Object({
	errId: t.String(),
	code: t.String(),
	message: t.String(),
	statusCode: t.Number(),
});

const MarginRuleIdParams = t.Object({
	id: t.String({ format: "uuid" }),
});

const MarginRuleResponse = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	minPrice: t.String(),
	maxPrice: t.Nullable(t.String()),
	marginPercent: t.String(),
	sortOrder: t.Integer({ minimum: 0 }),
	createdAt: t.Date(),
	updatedAt: t.Date(),
});

const CreateMarginRuleBody = t.Object({
	name: t.String({ minLength: 1, maxLength: 100 }),
	minPrice: t.Number({ minimum: 0 }),
	maxPrice: t.Optional(t.Nullable(t.Number({ minimum: 0 }))),
	marginPercent: t.Number({ minimum: 0, maximum: 100 }),
	sortOrder: t.Optional(t.Integer({ minimum: 0 })),
});

const UpdateMarginRuleBody = t.Partial(CreateMarginRuleBody);

export const adminMarginRulesRoute = new Elysia({ prefix: "/margin-rules" })
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
