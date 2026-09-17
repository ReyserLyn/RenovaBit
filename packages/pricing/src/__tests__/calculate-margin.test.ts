/**
 * Unit tests for calculate-margin.ts pure functions.
 */
import { describe, expect, it } from "bun:test";
import { calculateSalePrice } from "../calculate-margin";

describe("calculateSalePrice", () => {
	it("applies a clean percent", () => {
		expect(calculateSalePrice(100, 15)).toBe(115);
	});

	it("handles a 0% margin (returns the supplier price)", () => {
		expect(calculateSalePrice(100, 0)).toBe(100);
	});

	it("rounds to 2 decimal places", () => {
		// 33.33 * 1.155 = 38.49615 → rounds to 38.5
		expect(calculateSalePrice(33.33, 15.5)).toBe(38.5);
	});

	it("floors negative margin at 0% — never produces a negative sale price", () => {
		expect(calculateSalePrice(100, -10)).toBe(100);
		expect(calculateSalePrice(100, -50)).toBe(100);
	});

	it("floors extremely negative margin at 0%", () => {
		expect(calculateSalePrice(100, -9999)).toBe(100);
	});
});
