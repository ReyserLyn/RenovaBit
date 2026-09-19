import { t, type UnwrapSchema } from "elysia";

// ── Shared literal unions ──────────────────────
// TypeBox needs a literal tuple; the DB enums remain the storage source of truth.

const ComplaintTypeSchema = t.Union([t.Literal("reclamo"), t.Literal("queja")]);

const ComplaintDocTypeSchema = t.Union([
	t.Literal("DNI"),
	t.Literal("CE"),
	t.Literal("RUC"),
	t.Literal("PASAPORTE"),
]);

const ComplaintStatusSchema = t.Union([
	t.Literal("pending"),
	t.Literal("in_review"),
	t.Literal("responded"),
]);

// ── Responses ────────────────────────────────

const CreatedComplaintResponse = t.Object({
	id: t.String({ format: "uuid" }),
	code: t.String(),
	status: ComplaintStatusSchema,
	createdAt: t.String(),
});

const ComplaintResponse = t.Object({
	id: t.String({ format: "uuid" }),
	code: t.String(),
	type: ComplaintTypeSchema,
	fullName: t.String(),
	docType: ComplaintDocTypeSchema,
	docNumber: t.String(),
	email: t.String(),
	phone: t.String(),
	address: t.String(),
	orderNumber: t.Nullable(t.String()),
	isMinor: t.Boolean(),
	guardianName: t.Nullable(t.String()),
	guardianDocNumber: t.Nullable(t.String()),
	description: t.String(),
	request: t.String(),
	status: ComplaintStatusSchema,
	responseText: t.Nullable(t.String()),
	respondedAt: t.Nullable(t.String()),
	createdAt: t.String(),
	updatedAt: t.String(),
});

const ComplaintListItem = t.Object({
	id: t.String({ format: "uuid" }),
	code: t.String(),
	type: ComplaintTypeSchema,
	fullName: t.String(),
	docType: ComplaintDocTypeSchema,
	docNumber: t.String(),
	email: t.String(),
	phone: t.String(),
	orderNumber: t.Nullable(t.String()),
	isMinor: t.Boolean(),
	status: ComplaintStatusSchema,
	createdAt: t.String(),
	respondedAt: t.Nullable(t.String()),
});

const ComplaintListResponse = t.Object({
	complaints: t.Array(ComplaintListItem),
	total: t.Integer({ minimum: 0 }),
});

// ── Bodies ───────────────────────────────────

const CreateComplaintBody = t.Object({
	type: ComplaintTypeSchema,
	fullName: t.String({ minLength: 3, maxLength: 255 }),
	docType: ComplaintDocTypeSchema,
	docNumber: t.String({ minLength: 4, maxLength: 20, pattern: "^[A-Za-z0-9-]+$" }),
	email: t.String({ format: "email", maxLength: 255 }),
	// Digits only (optional +51 prefix): letters must be rejected.
	phone: t.String({
		minLength: 6,
		maxLength: 20,
		pattern: "^\\+?[0-9]{6,15}$",
	}),
	address: t.String({ minLength: 5, maxLength: 500 }),
	orderNumber: t.Optional(t.Nullable(t.String({ minLength: 1, maxLength: 50 }))),
	isMinor: t.Optional(t.Boolean({ default: false })),
	guardianName: t.Optional(t.Nullable(t.String({ minLength: 3, maxLength: 255 }))),
	guardianDocNumber: t.Optional(t.Nullable(t.String({ minLength: 4, maxLength: 20 }))),
	description: t.String({ minLength: 10, maxLength: 5000 }),
	request: t.String({ minLength: 10, maxLength: 5000 }),
});

const AdminUpdateComplaintBody = t.Object({
	responseText: t.String({ minLength: 10, maxLength: 5000 }),
});

// ── Params ───────────────────────────────────

const IdParams = t.Object({
	id: t.String({ format: "uuid" }),
});

// ── Query ────────────────────────────────────

const AdminComplaintsListQuery = t.Object({
	status: t.Optional(ComplaintStatusSchema),
	search: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
	page: t.Optional(t.String()),
	limit: t.Optional(t.String()),
});

// ── Error ─────────────────────────────────────

export const ErrorResponse = t.Object({
	errId: t.String(),
	code: t.String(),
	message: t.String(),
	statusCode: t.Number(),
});

// ── Export ────────────────────────────────────

type ComplaintModelShape = {
	createBody: typeof CreateComplaintBody;
	adminUpdateBody: typeof AdminUpdateComplaintBody;
	idParams: typeof IdParams;
	adminListQuery: typeof AdminComplaintsListQuery;
	createdResponse: typeof CreatedComplaintResponse;
	complaintResponse: typeof ComplaintResponse;
	complaintListItem: typeof ComplaintListItem;
	complaintListResponse: typeof ComplaintListResponse;
};

export const ComplaintModel: ComplaintModelShape = {
	// Bodies
	createBody: CreateComplaintBody,
	adminUpdateBody: AdminUpdateComplaintBody,

	// Params
	idParams: IdParams,

	// Query
	adminListQuery: AdminComplaintsListQuery,

	// Responses
	createdResponse: CreatedComplaintResponse,
	complaintResponse: ComplaintResponse,
	complaintListItem: ComplaintListItem,
	complaintListResponse: ComplaintListResponse,
};

export type ComplaintModel = {
	[k in keyof ComplaintModelShape]: UnwrapSchema<ComplaintModelShape[k]>;
};

export type CreatedComplaintResponse = typeof CreatedComplaintResponse.static;
export type ComplaintResponse = typeof ComplaintResponse.static;
export type ComplaintListItem = typeof ComplaintListItem.static;
