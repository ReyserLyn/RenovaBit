import { t } from "elysia";

// ── Error ──────────────────────────────────────────

export const ErrorResponse = t.Object({
	errId: t.String(),
	code: t.String(),
	message: t.String(),
	statusCode: t.Number(),
});

// ── Params ─────────────────────────────────────────

export const MarginRuleIdParams = t.Object({
	id: t.String({ format: "uuid" }),
});

// ── Responses ──────────────────────────────────────

export const MarginRuleResponse = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	minPrice: t.String(),
	maxPrice: t.Nullable(t.String()),
	customerPct: t.String(),
	sortOrder: t.Integer({ minimum: 0 }),
	createdAt: t.Date(),
	updatedAt: t.Date(),
});

// ── Bodies ─────────────────────────────────────────

/**
 * Price bounds are `numeric(10,2)` in the DB (8 integer digits + 2 decimals).
 * `maximum` keeps an oversized amount a 400 instead of a DB 500.
 */
const MAX_MARGIN_RULE_PRICE = 99_999_999.99;

export const CreateMarginRuleBody = t.Object({
	name: t.String({ minLength: 1, maxLength: 100 }),
	minPrice: t.Number({ minimum: 0, maximum: MAX_MARGIN_RULE_PRICE }),
	maxPrice: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: MAX_MARGIN_RULE_PRICE }))),
	customerPct: t.Number({ minimum: 0, maximum: 100 }),
	sortOrder: t.Optional(t.Integer({ minimum: 0 })),
});

export const UpdateMarginRuleBody = t.Partial(CreateMarginRuleBody);
