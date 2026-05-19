import { brands } from "@renovabit/db/schema";
import { createInsertSchema } from "drizzle-typebox";
import { t, type UnwrapSchema } from "elysia";

const _insert = createInsertSchema(brands, {
	name: t.String({ minLength: 1, maxLength: 100 }),
	slug: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
	description: t.Optional(t.String({ maxLength: 5000 })),
	imageUrl: t.Optional(t.String({ maxLength: 2048 })),
});

export const BrandModel = {
	createBody: t.Omit(_insert, [
		"id",
		"createdAt",
		"updatedAt",
		"seoTitle",
		"seoDescription",
		"seoKeywords",
		"isActive",
		"isFeatured",
	]),
	updateBody: t.Partial(t.Omit(_insert, ["id", "createdAt", "updatedAt"])),
	params: t.Object({ slug: t.String() }),
	bulkDelete: t.Object({
		ids: t.Array(t.String({ format: "uuid" }), { minItems: 1, maxItems: 50 }),
	}),
} as const;

export type BrandModel = { [k in keyof typeof BrandModel]: UnwrapSchema<(typeof BrandModel)[k]> };
