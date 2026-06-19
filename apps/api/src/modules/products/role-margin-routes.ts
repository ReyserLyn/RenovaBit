/**
 * Role-specific margin rules — admin CRUD.
 * Prefix: /api/v1/admin/margin-rules/role
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

const RoleMarginRuleIdParams = t.Object({
	id: t.String({ format: "uuid" }),
});

const RoleMarginRuleResponse = t.Object({
	id: t.String({ format: "uuid" }),
	role: t.Union([t.Literal("customer"), t.Literal("distributor")]),
	minPrice: t.String(),
	maxPrice: t.Nullable(t.String()),
	marginPercent: t.String(),
	sortOrder: t.Integer({ minimum: 0 }),
	createdAt: t.Date(),
	updatedAt: t.Date(),
});

const CreateRoleMarginRuleBody = t.Object({
	role: t.Union([t.Literal("customer"), t.Literal("distributor")]),
	minPrice: t.Number({ minimum: 0 }),
	maxPrice: t.Optional(t.Nullable(t.Number({ minimum: 0 }))),
	marginPercent: t.Number({ minimum: 0, maximum: 100 }),
	sortOrder: t.Optional(t.Integer({ minimum: 0 })),
});

const UpdateRoleMarginRuleBody = t.Partial(CreateRoleMarginRuleBody);

export const adminRoleMarginRulesRoute = new Elysia({ prefix: "/margin-rules/role" })
	// ── List ──────────────────────────────────────
	.get("/", async () => MarginRulesService.listRole(), {
		isAdmin: true,
		response: {
			200: t.Array(RoleMarginRuleResponse),
			401: ErrorResponse,
			403: ErrorResponse,
		},
		detail: { summary: "Listar reglas de margen por rol", tags: ["Margin"] },
	})

	// ── Create ────────────────────────────────────
	.post(
		"/",
		async ({ body, set }) => {
			set.status = 201;
			return MarginRulesService.createRole(body);
		},
		{
			isAdmin: true,
			body: CreateRoleMarginRuleBody,
			response: {
				201: RoleMarginRuleResponse,
				400: ErrorResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				409: ErrorResponse,
			},
			detail: { summary: "Crear regla de margen por rol", tags: ["Margin"] },
		},
	)

	// ── Update ────────────────────────────────────
	.put("/:id", async ({ params: { id }, body }) => MarginRulesService.updateRole(id, body), {
		isAdmin: true,
		params: RoleMarginRuleIdParams,
		body: UpdateRoleMarginRuleBody,
		response: {
			200: RoleMarginRuleResponse,
			400: ErrorResponse,
			401: ErrorResponse,
			403: ErrorResponse,
			404: ErrorResponse,
		},
		detail: { summary: "Actualizar regla de margen por rol", tags: ["Margin"] },
	})

	// ── Delete ────────────────────────────────────
	.delete(
		"/:id",
		async ({ params: { id }, set }) => {
			const deleted = await MarginRulesService.deleteRole(id);
			if (!deleted) throw notFound("Regla de margen no encontrada");
			set.status = 204;
		},
		{
			isAdmin: true,
			params: RoleMarginRuleIdParams,
			response: {
				204: t.Undefined(),
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Eliminar regla de margen por rol", tags: ["Margin"] },
		},
	);
