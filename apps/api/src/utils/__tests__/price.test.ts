import { describe, expect, it } from "bun:test";
import { sameMoneyAmount } from "../price";

describe("sameMoneyAmount", () => {
	it("treats a scale-free amount as equal to its scaled form", () => {
		// The production bug: Postgres returns numeric(10,2) values as "90.00"
		// while the feed produces "90", so the sync reported 969 products as
		// updated on every run for a change that never happened.
		expect(sameMoneyAmount("90.00", "90")).toBe(true);
		expect(sameMoneyAmount("90", "90.00")).toBe(true);
	});

	it("ignores insignificant trailing zeros on both sides", () => {
		expect(sameMoneyAmount("90.10", "90.1")).toBe(true);
		expect(sameMoneyAmount("0.50", "0.5")).toBe(true);
		expect(sameMoneyAmount("100.00", "100")).toBe(true);
	});

	it("detects real differences", () => {
		expect(sameMoneyAmount("90.00", "91.00")).toBe(false);
		expect(sameMoneyAmount("90.00", "90.01")).toBe(false);
		expect(sameMoneyAmount("0.00", "0.01")).toBe(false);
	});

	it("falls back to string equality when a value is not numeric", () => {
		expect(sameMoneyAmount("abc", "abc")).toBe(true);
		expect(sameMoneyAmount("abc", "90")).toBe(false);
		expect(sameMoneyAmount("", "")).toBe(true);
	});
});
