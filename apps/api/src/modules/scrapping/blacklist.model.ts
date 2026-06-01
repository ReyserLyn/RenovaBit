import { scrapingBlacklist } from "@renovabit/db/schema";
import { createSelectSchema } from "drizzle-typebox";
import { t, type UnwrapSchema } from "elysia";

// ── Response ───────────────────────────────────────

const BlacklistEntry = createSelectSchema(scrapingBlacklist);

const AddResult = t.Object({
	entry: BlacklistEntry,
	productDeleted: t.Boolean(),
});

const RemoveResult = t.Object({
	deleted: t.Boolean(),
});

// ── Error ──────────────────────────────────────────

export const ErrorResponse = t.Object({
	errId: t.String(),
	code: t.String(),
	message: t.String(),
	statusCode: t.Number(),
});

// ── Export ─────────────────────────────────────────

export const BlacklistModel = {
	// Query
	listQuery: t.Object({
		source: t.Optional(t.String()),
	}),

	// Bodies
	addBody: t.Object({
		externalId: t.String({ minLength: 1, maxLength: 255 }),
		source: t.Optional(t.String({ maxLength: 100 })),
		reason: t.Optional(t.String()),
		productName: t.Optional(t.String({ maxLength: 255 })),
	}),
	removeBody: t.Object({
		externalId: t.String({ minLength: 1, maxLength: 255 }),
		source: t.Optional(t.String({ maxLength: 100 })),
	}),

	// Responses
	entryResponse: BlacklistEntry,
	listResponse: t.Array(BlacklistEntry),
	addResponse: AddResult,
	removeResponse: RemoveResult,
} as const;

export type BlacklistModel = {
	[k in keyof typeof BlacklistModel]: UnwrapSchema<(typeof BlacklistModel)[k]>;
};
