import type { Static } from "@sinclair/typebox";
import { t, type UnwrapSchema } from "elysia";

// ── Scraped Item (uso interno del service) ─────────

export const ScrapedItemSchema = t.Object({
	providerId: t.String(),
	rawName: t.String(),
	rawPrice: t.String(),
	rawStock: t.Integer(),
});

export type ScrapedItem = Static<typeof ScrapedItemSchema>;

// ── Run Response ───────────────────────────────────

const RunResponse = t.Object({
	success: t.Boolean(),
	jobId: t.String(),
	message: t.String(),
});

// ── Export ─────────────────────────────────────────

export const ScrapingModel = {
	runQuery: t.Object({
		limit: t.Optional(t.String()),
	}),
	runResponse: RunResponse,
} as const;

export type ScrapingModel = {
	[k in keyof typeof ScrapingModel]: UnwrapSchema<(typeof ScrapingModel)[k]>;
};
