/**
 * Margin rules — schema contract tests.
 *
 * Validates the TypeBox schemas (request/response shapes) used by the
 * /api/v1/admin/margin-rules endpoint. These are the same schemas Elysia
 * uses for body parsing and response serialization, so passing here
 * means the contract is correct.
 */
import { describe, expect, it } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
	CreateMarginRuleBody,
	MarginRuleResponse,
	UpdateMarginRuleBody,
} from "@/modules/products/margin-routes";

const validRule = {
	id: "00000000-0000-0000-0000-000000000001",
	name: "Tiers bajos",
	minPrice: "0",
	maxPrice: "100",
	customerPct: "20",
	sortOrder: 0,
	createdAt: new Date("2026-01-01T00:00:00Z"),
	updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const validCreateBody = {
	name: "Tiers bajos",
	minPrice: 0,
	maxPrice: 100,
	customerPct: 20,
	sortOrder: 0,
};

// ── MarginRuleResponse ───────────────────────────────────

describe("MarginRuleResponse", () => {
	it("accepts a complete response row", () => {
		expect(Value.Check(MarginRuleResponse, validRule)).toBe(true);
	});

	it("accepts maxPrice = null (open-ended tier)", () => {
		expect(Value.Check(MarginRuleResponse, { ...validRule, maxPrice: null })).toBe(true);
	});

	it("rejects missing fields", () => {
		const { name: _name, ...partial } = validRule;
		expect(Value.Check(MarginRuleResponse, partial)).toBe(false);
	});

	it("rejects negative sortOrder", () => {
		expect(Value.Check(MarginRuleResponse, { ...validRule, sortOrder: -1 })).toBe(false);
	});

	it("rejects non-uuid id", () => {
		expect(Value.Check(MarginRuleResponse, { ...validRule, id: "not-a-uuid" })).toBe(false);
	});
});

// ── CreateMarginRuleBody ─────────────────────────────────

describe("CreateMarginRuleBody", () => {
	it("accepts a complete create body", () => {
		expect(Value.Check(CreateMarginRuleBody, validCreateBody)).toBe(true);
	});

	it("accepts a body without optional maxPrice and sortOrder", () => {
		const { maxPrice: _mp, sortOrder: _so, ...minimal } = validCreateBody;
		expect(Value.Check(CreateMarginRuleBody, minimal)).toBe(true);
	});

	it("accepts maxPrice = null (open-ended tier)", () => {
		expect(Value.Check(CreateMarginRuleBody, { ...validCreateBody, maxPrice: null })).toBe(true);
	});

	it("rejects empty name", () => {
		expect(Value.Check(CreateMarginRuleBody, { ...validCreateBody, name: "" })).toBe(false);
	});

	it("rejects name longer than 100 chars", () => {
		expect(Value.Check(CreateMarginRuleBody, { ...validCreateBody, name: "x".repeat(101) })).toBe(
			false,
		);
	});

	it("rejects negative minPrice", () => {
		expect(Value.Check(CreateMarginRuleBody, { ...validCreateBody, minPrice: -1 })).toBe(false);
	});

	it("rejects customerPct > 100", () => {
		expect(Value.Check(CreateMarginRuleBody, { ...validCreateBody, customerPct: 101 })).toBe(false);
	});

	it("rejects negative customerPct", () => {
		expect(Value.Check(CreateMarginRuleBody, { ...validCreateBody, customerPct: -5 })).toBe(false);
	});

	it("accepts 0% (rule is the floor)", () => {
		expect(Value.Check(CreateMarginRuleBody, { ...validCreateBody, customerPct: 0 })).toBe(true);
	});
});

// ── UpdateMarginRuleBody ─────────────────────────────────

describe("UpdateMarginRuleBody", () => {
	it("accepts an empty object (no-op)", () => {
		expect(Value.Check(UpdateMarginRuleBody, {})).toBe(true);
	});

	it("accepts a partial update with one field", () => {
		expect(Value.Check(UpdateMarginRuleBody, { name: "Renamed" })).toBe(true);
	});

	it("accepts maxPrice = null in an update (close the tier)", () => {
		expect(Value.Check(UpdateMarginRuleBody, { maxPrice: null })).toBe(true);
	});

	it("rejects name longer than 100 chars in an update", () => {
		expect(Value.Check(UpdateMarginRuleBody, { name: "x".repeat(101) })).toBe(false);
	});

	it("rejects customerPct > 100 in an update", () => {
		expect(Value.Check(UpdateMarginRuleBody, { customerPct: 200 })).toBe(false);
	});

	it("rejects negative minPrice in an update", () => {
		expect(Value.Check(UpdateMarginRuleBody, { minPrice: -10 })).toBe(false);
	});
});
