import { t, type UnwrapSchema } from "elysia";

// ── Constants ──────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

// ── Request ────────────────────────────────────────

const PresignRequest = t.Object({
	filename: t.String({
		minLength: 1,
		maxLength: 255,
		pattern: "^[^/\\\\]+$", // sin path traversal
		error: "Nombre de archivo inválido",
	}),
	contentType: t.UnionEnum(ALLOWED_IMAGE_TYPES, {
		error: "Tipo de imagen no permitido. Usar: jpeg, png, webp, avif",
	}),
});

// ── Response ───────────────────────────────────────

const PresignResponse = t.Object({
	uploadUrl: t.String({ format: "uri" }),
	publicUrl: t.String({ format: "uri" }),
	key: t.String(),
	expiresAt: t.String({ format: "date-time" }),
});

// ── Error ──────────────────────────────────────────

export const ErrorResponse = t.Object({
	errId: t.String(),
	code: t.String(),
	message: t.String(),
	statusCode: t.Number(),
});

// ── Export ─────────────────────────────────────────

export const StorageModel = {
	presignRequest: PresignRequest,
	presignResponse: PresignResponse,
} as const;

export type StorageModel = {
	[k in keyof typeof StorageModel]: UnwrapSchema<(typeof StorageModel)[k]>;
};
