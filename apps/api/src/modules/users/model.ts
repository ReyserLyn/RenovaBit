import { t, type UnwrapSchema } from "elysia";

// ── Constants ─────────────────────────────────────

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"] as const;

// ── Helpers ───────────────────────────────────────

/** Campo opcional que acepta string vacío (se envía como "" en formdata para campos no requeridos). */
const StringOrEmpty = (opts: { maxLength: number }) =>
	t.Union([t.String({ maxLength: opts.maxLength }), t.Literal("")]);

// ── Response ──────────────────────────────────────

const UserProfile = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	email: t.String({ format: "email" }),
	role: t.String(),
	image: t.Union([t.String(), t.Null()]),
	emailVerified: t.Boolean(),
	username: t.Union([t.String(), t.Null()]),
	displayUsername: t.Union([t.String(), t.Null()]),
	lastname: t.Union([t.String(), t.Null()]),
	phone: t.Union([t.String(), t.Null()]),
	createdAt: t.Date(),
	updatedAt: t.Date(),
});

// ── Update profile body ──────────────────────────

const UpdateProfileBody = t.Object({
	name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
	lastname: t.Optional(t.Union([t.String({ maxLength: 100 }), t.Literal("")])),
	username: t.Optional(StringOrEmpty({ maxLength: 30 })),
	displayUsername: t.Optional(StringOrEmpty({ maxLength: 100 })),
	phone: t.Optional(StringOrEmpty({ maxLength: 20 })),
	image: t.Optional(
		t.File({
			type: [...ALLOWED_AVATAR_TYPES],
			maxSize: "5m",
			error: "Formato de imagen no permitido. Máximo 5 MB (PNG, JPEG, WebP, AVIF).",
		}),
	),
	removeImage: t.Optional(t.Literal("true")),
});

// ── Error ────────────────────────────────────────

export const ErrorResponse = t.Object({
	errId: t.String(),
	code: t.String(),
	message: t.String(),
	statusCode: t.Number(),
});

// ── Export ───────────────────────────────────────

export const UserModel = {
	userProfile: UserProfile,
	userListResponse: t.Array(UserProfile),
	updateProfileBody: UpdateProfileBody,
} as const;

export type UserModel = {
	[k in keyof typeof UserModel]: UnwrapSchema<(typeof UserModel)[k]>;
};
