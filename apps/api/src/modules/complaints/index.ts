import { Elysia } from "elysia";
import { ComplaintModel, ErrorResponse } from "./model";
import { ComplaintService } from "./service";

// ═══════════════════════════════════════════════════
//  PUBLIC — Libro de Reclamaciones (Ley 29571)
//  Prefijo: /api/v1/complaints
// ═══════════════════════════════════════════════════

// Rate limiting: POST /complaints is covered by the shared user-strict tier
// (30 req/60s/IP, `user-strict:<ip>` Redis key) via `skipUserStrict` in
// plugins/rate-limit/keys.ts. It must NOT mount its own elysia-rate-limit
// instance here: the plugin registers a scoped onError hook that shadows the
// global error handler for every sibling route registered after this module.

export const complaintsRoute = new Elysia({ prefix: "/complaints" })
	// ── Create Complaint ────────────────────────
	.post(
		"/",
		async ({ body, set }) => {
			const complaint = await ComplaintService.create(body);
			set.status = 201;
			return complaint;
		},
		{
			body: ComplaintModel.createBody,
			response: {
				201: ComplaintModel.createdResponse,
				400: ErrorResponse,
				429: ErrorResponse,
			},
			detail: {
				summary: "Registrar reclamo o queja (Libro de Reclamaciones)",
				tags: ["Complaints"],
			},
		},
	);
