/**
 * Unit tests for lookup-margin-rule.ts pure function.
 */
import { describe, expect, it } from "bun:test";
import { lookupMarginRule } from "../lookup-margin-rule";

// One row covers both non-admin roles. The lookup returns the column pair
// (customer + distributor); callers pick the right column for the user's role.
const rules = [
	{ minPrice: "0", maxPrice: "100", customerPct: "25", distributorPct: "22" },
	{ minPrice: "100", maxPrice: "200", customerPct: "20", distributorPct: "17" },
	{ minPrice: "200", maxPrice: "800", customerPct: "15", distributorPct: "12" },
	{ minPrice: "800", maxPrice: null, customerPct: "10", distributorPct: "7" },
];

describe("lookupMarginRule", () => {
	it("finds rule for supplier price 0", () => {
		const result = lookupMarginRule(0, rules);
		expect(result).not.toBeNull();
		expect(result).toEqual({ customerPct: "25", distributorPct: "22" });
	});

	it("finds rule for supplier price 50", () => {
		const result = lookupMarginRule(50, rules);
		expect(result).toEqual({ customerPct: "25", distributorPct: "22" });
	});

	it("finds rule for supplier price 99.99", () => {
		const result = lookupMarginRule(99.99, rules);
		expect(result).toEqual({ customerPct: "25", distributorPct: "22" });
	});

	it("moves to next tier when price equals maxPrice (exclusive)", () => {
		const result = lookupMarginRule(100, rules);
		expect(result).toEqual({ customerPct: "20", distributorPct: "17" });
	});

	it("finds rule for price 100 (same as min of next)", () => {
		const result = lookupMarginRule(100, rules);
		expect(result).toEqual({ customerPct: "20", distributorPct: "17" });
	});

	it("finds rule for price 199.99", () => {
		const result = lookupMarginRule(199.99, rules);
		expect(result).toEqual({ customerPct: "20", distributorPct: "17" });
	});

	it("finds rule for price 200", () => {
		const result = lookupMarginRule(200, rules);
		expect(result).toEqual({ customerPct: "15", distributorPct: "12" });
	});

	it("finds rule for price 799.99", () => {
		const result = lookupMarginRule(799.99, rules);
		expect(result).toEqual({ customerPct: "15", distributorPct: "12" });
	});

	it("finds rule for price 800", () => {
		const result = lookupMarginRule(800, rules);
		expect(result).toEqual({ customerPct: "10", distributorPct: "7" });
	});

	it("handles Infinity (maxPrice null) for very large prices", () => {
		const result = lookupMarginRule(999999, rules);
		expect(result).toEqual({ customerPct: "10", distributorPct: "7" });
	});

	it("returns null when no rule matches", () => {
		const result = lookupMarginRule(100, []);
		expect(result).toBeNull();
	});

	it("returns null for negative supplier price (below first tier min)", () => {
		const result = lookupMarginRule(-1, rules);
		expect(result).toBeNull();
	});
});
