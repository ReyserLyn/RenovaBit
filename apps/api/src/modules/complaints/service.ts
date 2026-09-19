import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import type { ComplaintStatus } from "@renovabit/db/schema";
import { complaints } from "@renovabit/db/schema";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SEARCH_MAX_LENGTH } from "@/constants";
import { notifyAdminsOfComplaint } from "@/modules/notifications/notifications.service";
import { formatDate } from "@/utils/date";
import { isUniqueViolationOn } from "@/utils/db-helpers";
import { logger } from "@/utils/logger";
import { escapeLikePattern } from "@/utils/prefix-tsquery";
import type { ComplaintListItem, ComplaintModel, ComplaintResponse } from "./model";

type CreateBody = ComplaintModel["createBody"];
type UpdateBody = ComplaintModel["adminUpdateBody"];
/** Query strings from HTTP; numeric pages are accepted from internal callers/tests. */
type ListOptions = Omit<ComplaintModel["adminListQuery"], "page" | "limit"> & {
	page?: string | number;
	limit?: string | number;
};

type ComplaintRow = typeof complaints.$inferSelect;

// ── Constants ──────────────────────────────────

const CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_SUFFIX_LENGTH = 8;
const MAX_CODE_RETRIES = 5;
/** Abuse guard: a single document cannot flood the book with pending claims. */
const MAX_PENDING_COMPLAINTS_PER_DOC = 3;
/** Statuses a response may still be issued from. */
const RESPONDABLE_STATUSES: ComplaintStatus[] = ["pending", "in_review"];

const generateComplaintCodeSuffix = customAlphabet(CODE_ALPHABET, CODE_SUFFIX_LENGTH);

// ── Helpers ────────────────────────────────────

function sanitizePagination(
	page: string | number | undefined = 0,
	limit: string | number | undefined = DEFAULT_PAGE_SIZE,
) {
	const parseNumber = (value: string | number | undefined, fallback: number): number => {
		if (value === undefined) return fallback;
		if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) ? parsed : fallback;
	};

	const parsedPage = parseNumber(page, 0);
	const parsedLimit = parseNumber(limit, DEFAULT_PAGE_SIZE);

	const safePage = parsedPage >= 0 ? Math.trunc(parsedPage) : 0;
	const requestedLimit = parsedLimit > 0 ? Math.trunc(parsedLimit) : DEFAULT_PAGE_SIZE;
	const safeLimit = Math.min(requestedLimit, MAX_PAGE_SIZE);
	return { safeLimit, offset: safePage * safeLimit };
}

function toComplaintResponse(row: ComplaintRow): ComplaintResponse {
	return {
		id: row.id,
		code: row.code,
		type: row.type,
		fullName: row.fullName,
		docType: row.docType,
		docNumber: row.docNumber,
		email: row.email,
		phone: row.phone,
		address: row.address,
		orderNumber: row.orderNumber ?? null,
		isMinor: row.isMinor,
		guardianName: row.guardianName ?? null,
		guardianDocNumber: row.guardianDocNumber ?? null,
		description: row.description,
		request: row.request,
		status: row.status,
		responseText: row.responseText ?? null,
		respondedAt: row.respondedAt ? formatDate(row.respondedAt) : null,
		createdAt: formatDate(row.createdAt),
		updatedAt: formatDate(row.updatedAt),
	};
}

function toComplaintListItem(row: ComplaintRow): ComplaintListItem {
	return {
		id: row.id,
		code: row.code,
		type: row.type,
		fullName: row.fullName,
		docType: row.docType,
		docNumber: row.docNumber,
		email: row.email,
		phone: row.phone,
		orderNumber: row.orderNumber ?? null,
		isMinor: row.isMinor,
		status: row.status,
		createdAt: formatDate(row.createdAt),
		respondedAt: row.respondedAt ? formatDate(row.respondedAt) : null,
	};
}

// ═══════════════════════════════════════════════════
//  CREATE (public)
// ═══════════════════════════════════════════════════

async function create(data: CreateBody) {
	const isMinor = data.isMinor ?? false;
	const guardianName = data.guardianName?.trim() || null;
	const guardianDocNumber = data.guardianDocNumber?.trim() || null;

	// A minor cannot file a claim on their own: the guardian must be identified.
	if (isMinor && (!guardianName || !guardianDocNumber)) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message:
				"Para registrar un reclamo de un menor de edad debes indicar el nombre y el documento del padre, madre o apoderado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	const docNumber = data.docNumber.trim();

	const [pendingRow] = await db
		.select({ pending: sql<number>`count(*)::int` })
		.from(complaints)
		.where(and(eq(complaints.docNumber, docNumber), eq(complaints.status, "pending")));

	if ((pendingRow?.pending ?? 0) >= MAX_PENDING_COMPLAINTS_PER_DOC) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: `Ya tienes ${MAX_PENDING_COMPLAINTS_PER_DOC} reclamos pendientes con este documento. Espera nuestra respuesta antes de registrar otro.`,
			logLevel: "info",
			doNotLog: true,
		});
	}

	let created: ComplaintRow | undefined;
	for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
		const code = `RB-${generateComplaintCodeSuffix()}`;
		try {
			const [row] = await db
				.insert(complaints)
				.values({
					code,
					type: data.type,
					fullName: data.fullName.trim(),
					docType: data.docType,
					docNumber,
					email: data.email.trim(),
					phone: data.phone.trim(),
					address: data.address.trim(),
					orderNumber: data.orderNumber?.trim() || null,
					isMinor,
					guardianName,
					guardianDocNumber,
					description: data.description.trim(),
					request: data.request.trim(),
				})
				.returning();
			created = row;
			break;
		} catch (err) {
			if (!isUniqueViolationOn(err, "complaints_code_unique") || attempt === MAX_CODE_RETRIES - 1) {
				throw err;
			}
		}
	}

	if (!created) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al registrar el reclamo",
		});
	}

	// Best-effort admin alert: the complaint is already recorded and its
	// registration must never fail because the notification did.
	notifyAdminsOfComplaint({
		complaintId: created.id,
		code: created.code,
		type: created.type,
		fullName: created.fullName,
	}).catch((err) =>
		logger.withMetadata({ err, complaintId: created?.id }).error("[Complaint] Notification error"),
	);

	return {
		id: created.id,
		code: created.code,
		status: created.status,
		createdAt: formatDate(created.createdAt),
	};
}

// ═══════════════════════════════════════════════════
//  LIST (admin)
// ═══════════════════════════════════════════════════

async function listAdmin(
	options: ListOptions = {},
): Promise<{ complaints: ComplaintListItem[]; total: number }> {
	const conditions = [];
	if (options.status) {
		conditions.push(eq(complaints.status, options.status));
	}
	if (options.search) {
		const search = options.search.trim().slice(0, SEARCH_MAX_LENGTH);
		const term = `%${escapeLikePattern(search)}%`;
		const searchCondition = or(
			ilike(complaints.code, term),
			ilike(complaints.docNumber, term),
			ilike(complaints.fullName, term),
		);
		if (searchCondition) conditions.push(searchCondition);
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const { safeLimit, offset } = sanitizePagination(options.page, options.limit);

	const [countRow] = await db
		.select({ total: count(complaints.id) })
		.from(complaints)
		.where(where);
	const total = Number(countRow?.total ?? 0);

	const rows = await db
		.select()
		.from(complaints)
		.where(where)
		.orderBy(desc(complaints.createdAt))
		.limit(safeLimit)
		.offset(offset);

	return { complaints: rows.map(toComplaintListItem), total };
}

// ═══════════════════════════════════════════════════
//  DETAIL (admin)
// ═══════════════════════════════════════════════════

async function getByIdAdmin(id: string): Promise<ComplaintResponse | null> {
	const [row] = await db.select().from(complaints).where(eq(complaints.id, id)).limit(1);
	return row ? toComplaintResponse(row) : null;
}

// ═══════════════════════════════════════════════════
//  RESPOND (admin)
// ═══════════════════════════════════════════════════

async function respond(id: string, data: UpdateBody): Promise<ComplaintResponse> {
	// Single statement + status filter: concurrent responses cannot overwrite
	// the first one (the loser finds no row to update).
	const [updated] = await db
		.update(complaints)
		.set({
			responseText: data.responseText.trim(),
			status: "responded",
			respondedAt: new Date(),
		})
		.where(and(eq(complaints.id, id), inArray(complaints.status, RESPONDABLE_STATUSES)))
		.returning();

	if (updated) return toComplaintResponse(updated);

	const [existing] = await db
		.select({ status: complaints.status })
		.from(complaints)
		.where(eq(complaints.id, id))
		.limit(1);

	if (!existing) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Reclamo no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	throw createApiError({
		code: BackendErrorCodes.UNPROCESSABLE_ENTITY,
		message: "Este reclamo ya fue respondido",
		logLevel: "info",
		doNotLog: true,
	});
}

export const ComplaintService = {
	create,
	listAdmin,
	getByIdAdmin,
	respond,
};
