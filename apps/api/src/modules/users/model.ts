import { t, type UnwrapSchema } from "elysia";

// ── Response ────────────────────────────────────────

const UserSummary = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	email: t.String({ format: "email" }),
	role: t.String(),
	image: t.Union([t.String(), t.Null()]),
	emailVerified: t.Boolean(),
	username: t.Union([t.String(), t.Null()]),
	displayUsername: t.Union([t.String(), t.Null()]),
	phone: t.Union([t.String(), t.Null()]),
	createdAt: t.Date(),
	updatedAt: t.Date(),
});

// ── Error ──────────────────────────────────────────

export const ErrorResponse = t.Object({
	errId: t.String(),
	code: t.String(),
	message: t.String(),
	statusCode: t.Number(),
});

// ── Export ─────────────────────────────────────────

export const UserModel = {
	userSummaryResponse: UserSummary,
	userListResponse: t.Array(UserSummary),
} as const;

export type UserModel = {
	[k in keyof typeof UserModel]: UnwrapSchema<(typeof UserModel)[k]>;
};
