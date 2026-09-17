/**
 * Margin rules — overlap detection tests.
 *
 * Covers the pure `checkOverlap` function (no DB, no mocks). The
 * `assertNoOverlap` wrapper inside the service just runs this function
 * with the result of a DB query, so the contract is the same.
 */
import { describe, expect, it } from "bun:test";
import { checkOverlap } from "@/modules/margin-rules/service";

const rule = (overrides: Partial<{ id: string; minPrice: string; maxPrice: string | null }> = {}) =>
	({
		id: "00000000-0000-0000-0000-000000000001",
		minPrice: "0",
		maxPrice: "100",
		...overrides,
	}) as const;

describe("checkOverlap — non-overlapping ranges are accepted", () => {
	it("empty rules list → always allowed", () => {
		expect(() => checkOverlap([], 50, 100)).not.toThrow();
	});

	it("disjoint ranges → allowed", () => {
		const existing = [rule({ minPrice: "0", maxPrice: "50" })];
		expect(() => checkOverlap(existing, 100, 200)).not.toThrow();
	});

	it("adjacent at the boundary (max exclusive) → allowed", () => {
		// Existing [0, 100), new [100, 200) — share no interior point.
		const existing = [rule({ minPrice: "0", maxPrice: "100" })];
		expect(() => checkOverlap(existing, 100, 200)).not.toThrow();
	});

	it("adjacent in the other direction → allowed", () => {
		// Existing [100, 200), new [0, 100).
		const existing = [rule({ minPrice: "100", maxPrice: "200" })];
		expect(() => checkOverlap(existing, 0, 100)).not.toThrow();
	});
});

describe("checkOverlap — overlapping ranges throw 409", () => {
	it("exact same range → conflict", () => {
		const existing = [rule({ minPrice: "0", maxPrice: "100" })];
		expect(() => checkOverlap(existing, 0, 100)).toThrow();
	});

	it("partial overlap on the right → conflict", () => {
		// Existing [0, 100), new [50, 150)
		const existing = [rule({ minPrice: "0", maxPrice: "100" })];
		expect(() => checkOverlap(existing, 50, 150)).toThrow();
	});

	it("partial overlap on the left → conflict", () => {
		// Existing [50, 150), new [0, 100)
		const existing = [rule({ minPrice: "50", maxPrice: "150" })];
		expect(() => checkOverlap(existing, 0, 100)).toThrow();
	});

	it("new range fully contains existing → conflict", () => {
		const existing = [rule({ minPrice: "50", maxPrice: "100" })];
		expect(() => checkOverlap(existing, 0, 200)).toThrow();
	});

	it("existing range fully contains new → conflict", () => {
		const existing = [rule({ minPrice: "0", maxPrice: "200" })];
		expect(() => checkOverlap(existing, 50, 100)).toThrow();
	});

	it("new with maxPrice = null (∞) overlaps an existing range inside it → conflict", () => {
		const existing = [rule({ minPrice: "50", maxPrice: "100" })];
		expect(() => checkOverlap(existing, 0, null)).toThrow();
	});

	it("existing with maxPrice = null (∞) overlaps a new range inside it → conflict", () => {
		const existing = [rule({ minPrice: "0", maxPrice: null })];
		expect(() => checkOverlap(existing, 50, 100)).toThrow();
	});
});

describe("checkOverlap — excludeId lets the rule being updated skip itself", () => {
	it("a rule does not conflict with itself when its range hasn't changed", () => {
		const existing = [rule({ id: "self", minPrice: "0", maxPrice: "100" })];
		// Update with same range — should not throw because we exclude the rule itself.
		expect(() => checkOverlap(existing, 0, 100, "self")).not.toThrow();
	});

	it("excludeId does not hide a conflict with a DIFFERENT rule", () => {
		const existing = [
			rule({ id: "self", minPrice: "0", maxPrice: "100" }),
			rule({ id: "other", minPrice: "100", maxPrice: "200" }),
		];
		// Updating 'self' but moving it to [100, 200) would still conflict with 'other'.
		expect(() => checkOverlap(existing, 100, 200, "self")).toThrow();
	});
});

describe("checkOverlap — multiple existing rules", () => {
	it("conflict with the second rule, not the first", () => {
		const existing = [
			rule({ id: "a", minPrice: "0", maxPrice: "50" }),
			rule({ id: "b", minPrice: "100", maxPrice: "200" }),
		];
		// New [75, 150) — doesn't touch 'a', overlaps 'b' [100, 200)
		expect(() => checkOverlap(existing, 75, 150)).toThrow();
	});

	it("a new range that fits between two existing rules is allowed", () => {
		const existing = [
			rule({ id: "a", minPrice: "0", maxPrice: "50" }),
			rule({ id: "b", minPrice: "100", maxPrice: "200" }),
		];
		// New [50, 100) sits exactly in the gap.
		expect(() => checkOverlap(existing, 50, 100)).not.toThrow();
	});
});
