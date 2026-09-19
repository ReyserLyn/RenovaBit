import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia } from "elysia";
import { AuthMacros } from "@/modules/auth";
import { ComplaintModel, ErrorResponse } from "./model";
import { ComplaintService } from "./service";

// ═══════════════════════════════════════════════════
//  ADMIN — requiere isAdmin macro
//  Prefijo: /api/v1/admin/complaints
// ═══════════════════════════════════════════════════

export const adminComplaintsRoute = new Elysia({ prefix: "/complaints" })
	.use(AuthMacros)
	// ── List ────────────────────────────────────
	.get(
		"/",
		async ({ query }) => {
			return ComplaintService.listAdmin({
				status: query.status,
				search: query.search,
				page: query.page,
				limit: query.limit,
			});
		},
		{
			isAdmin: true,
			query: ComplaintModel.adminListQuery,
			response: {
				200: ComplaintModel.complaintListResponse,
				401: ErrorResponse,
				403: ErrorResponse,
			},
			detail: { summary: "Listar reclamos (admin)", tags: ["Complaints"] },
		},
	)

	// ── Detail ──────────────────────────────────
	.get(
		"/:id",
		async ({ params: { id } }) => {
			const complaint = await ComplaintService.getByIdAdmin(id);
			if (!complaint) {
				throw createApiError({
					code: BackendErrorCodes.NOT_FOUND_ERROR,
					message: "Reclamo no encontrado",
					logLevel: "info",
					doNotLog: true,
				});
			}
			return complaint;
		},
		{
			isAdmin: true,
			params: ComplaintModel.idParams,
			response: {
				200: ComplaintModel.complaintResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
			},
			detail: { summary: "Detalle de reclamo (admin)", tags: ["Complaints"] },
		},
	)

	// ── Respond ─────────────────────────────────
	.patch(
		"/:id",
		async ({ params: { id }, body }) => {
			return ComplaintService.respond(id, body);
		},
		{
			isAdmin: true,
			params: ComplaintModel.idParams,
			body: ComplaintModel.adminUpdateBody,
			response: {
				200: ComplaintModel.complaintResponse,
				400: ErrorResponse,
				401: ErrorResponse,
				403: ErrorResponse,
				404: ErrorResponse,
				422: ErrorResponse,
			},
			detail: { summary: "Responder reclamo (admin)", tags: ["Complaints"] },
		},
	);
