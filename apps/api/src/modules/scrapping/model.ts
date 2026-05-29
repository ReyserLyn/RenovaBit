import type { Static } from "@sinclair/typebox";
import { t, type UnwrapSchema } from "elysia";

// ── Scraped Item ────────────────────────────────────

export const ScrapedItemSchema = t.Object({
	providerId: t.String(),
	rawName: t.String(),
	rawPrice: t.String(),
	rawStock: t.Integer(),
});

export type ScrapedItem = Static<typeof ScrapedItemSchema>;

// ── Query ──────────────────────────────────────────

const RunQuerySchema = t.Object({
	limit: t.Optional(t.String()),
});

// ── Export ─────────────────────────────────────────

export const ScrapingModel = {
	runQuery: RunQuerySchema,
	scrapedItem: ScrapedItemSchema,
	scrapedItemList: t.Array(ScrapedItemSchema),
} as const;

export type ScrapingModel = {
	[k in keyof typeof ScrapingModel]: UnwrapSchema<(typeof ScrapingModel)[k]>;
};
