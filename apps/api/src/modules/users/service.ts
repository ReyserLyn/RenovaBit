import { PutObjectCommand } from "@aws-sdk/client-s3";
import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { users } from "@renovabit/db/schema";
import { and, asc, eq, ne } from "drizzle-orm";
import { auth } from "@/utils/auth/auth";
import { logger } from "@/utils/logger";
import { R2_BUCKET_NAME, R2_PUBLIC_URL, r2Client } from "@/utils/storage/client";
import { deleteEntityImage, EXT_MAP } from "@/utils/storage/helpers";

// ── Types ─────────────────────────────────────────

export interface UpdateProfileInput {
	name?: string;
	lastname?: string | null;
	username?: string | null;
	displayUsername?: string | null;
	phone?: string | null;
	image?: File | null;
	removeImage?: boolean;
}

// ── Column list (single source of truth) ───────────

const PROFILE_COLUMNS = {
	id: users.id,
	name: users.name,
	email: users.email,
	role: users.role,
	image: users.image,
	emailVerified: users.emailVerified,
	username: users.username,
	displayUsername: users.displayUsername,
	lastname: users.lastname,
	phone: users.phone,
	createdAt: users.createdAt,
	updatedAt: users.updatedAt,
} as const;

// ── Queries ────────────────────────────────────────

async function list() {
	return db.select(PROFILE_COLUMNS).from(users).orderBy(asc(users.name));
}

async function getProfile(userId: string) {
	const [user] = await db.select(PROFILE_COLUMNS).from(users).where(eq(users.id, userId)).limit(1);

	if (!user) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Usuario no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}
	return user;
}

// ── Avatar operations ─────────────────────────────

async function uploadAvatar(userId: string, file: File): Promise<string> {
	const ext = EXT_MAP[file.type] ?? "jpg";
	const uniqueId = crypto.randomUUID();
	const key = `avatars/${userId}/${uniqueId}.${ext}`;
	const buffer = new Uint8Array(await file.arrayBuffer());

	await r2Client.send(
		new PutObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: key,
			Body: buffer,
			ContentType: file.type,
		}),
	);

	return `${R2_PUBLIC_URL}/${key}`;
}

// ── Update profile ─────────────────────────────────

/**
 * Audit log note: a `profile_changes` table is recommended for production to detect
 * unauthorized role escalations and email changes. Until the table exists, we
 * log every change at INFO level so the events are captured in the application
 * log stream (and any future log aggregator).
 *
 * Recommended schema:
 *   CREATE TABLE profile_changes (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_id UUID NOT NULL REFERENCES users(id),
 *     field VARCHAR(64) NOT NULL,
 *     old_value TEXT,
 *     new_value TEXT,
 *     changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 *     changed_by VARCHAR(64) NOT NULL DEFAULT 'user',
 *     metadata JSONB
 *   );
 */
async function updateProfile(userId: string, input: UpdateProfileInput, headers: Headers) {
	// Derive username from displayUsername if applicable
	let resolvedUsername: string | null | undefined = input.username;
	if (input.displayUsername !== undefined) {
		if (input.displayUsername && !input.username) {
			resolvedUsername = input.displayUsername.trim().toLowerCase();
		} else if (!input.displayUsername) {
			resolvedUsername = null;
		}
	}

	// Build update fields for Better Auth
	const updateFields: Partial<
		Pick<
			typeof users.$inferInsert,
			"name" | "lastname" | "username" | "displayUsername" | "phone" | "image"
		>
	> = {};

	if (input.name !== undefined) updateFields.name = input.name;
	if (input.lastname !== undefined) updateFields.lastname = input.lastname || null;
	if (resolvedUsername !== undefined) updateFields.username = resolvedUsername || null;
	if (input.displayUsername !== undefined)
		updateFields.displayUsername = input.displayUsername || null;
	if (input.phone !== undefined) updateFields.phone = input.phone || null;

	// Handle avatar: upload to R2 first
	let newImageUrl: string | undefined;
	if (input.removeImage) {
		updateFields.image = null;
	} else if (input.image) {
		newImageUrl = await uploadAvatar(userId, input.image);
		updateFields.image = newImageUrl;
	}

	// Validate username uniqueness
	if (resolvedUsername) {
		const [existing] = await db
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.username, resolvedUsername), ne(users.id, userId)))
			.limit(1);

		if (existing) {
			// Clean up uploaded avatar if username conflict
			if (newImageUrl) void deleteEntityImage(newImageUrl);
			throw createApiError({
				code: BackendErrorCodes.CONFLICT,
				message: `El nombre de usuario "${resolvedUsername}" ya está en uso. Elige otro.`,
				metadataSafe: { field: "displayUsername" },
				logLevel: "info",
				doNotLog: true,
			});
		}
	}

	// If nothing to update, return current profile
	if (Object.keys(updateFields).length === 0) {
		return getProfile(userId);
	}

	// Fetch current user for old avatar cleanup
	const [current] = await db.select({ image: users.image }).from(users).where(eq(users.id, userId));
	if (!current) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Usuario no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	// Delegate to Better Auth — handles DB update + session refresh in Redis.
	// Better Auth infers userId from the session in the provided headers.
	try {
		await auth.api.updateUser({
			body: updateFields,
			headers,
		});
	} catch (err) {
		// Si la actualización falla, evitamos dejar el avatar recién subido huérfano en R2.
		if (newImageUrl) {
			deleteEntityImage(newImageUrl).catch((cleanupErr) =>
				logger
					.withError(cleanupErr)
					.warn("[Users] No se pudo limpiar avatar tras fallo en updateUser"),
			);
		}
		throw err;
	}

	// Clean up old avatar AFTER successful update
	if (input.removeImage || input.image) {
		void deleteEntityImage(current.image);
	}

	// Audit log: record every field that changed for future profile_changes table.
	// Captures the diff so the future table can be backfilled from the log stream.
	logger
		.withMetadata({
			event: "profile_updated",
			userId,
			changedFields: Object.keys(updateFields),
		})
		.info("Profile updated");

	// Return fresh DB profile (not session snapshot)
	return getProfile(userId);
}

// ── Public API ─────────────────────────────────────

export const UserService = {
	list,
	getProfile,
	updateProfile,
};
