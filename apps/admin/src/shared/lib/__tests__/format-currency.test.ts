import { describe, expect, it } from "bun:test";
import { formatCurrency } from "../format-currency";

/** Intl inserts a non-breaking space after "S/"; normalize it for comparison. */
const normalize = (value: string) => value.replace(/\u00a0/g, " ");

describe("formatCurrency", () => {
	it("formats a numeric string as PEN", () => {
		expect(normalize(formatCurrency("1234.5"))).toBe("S/ 1,234.50");
		expect(normalize(formatCurrency("0"))).toBe("S/ 0.00");
		expect(normalize(formatCurrency(" 7.25 "))).toBe("S/ 7.25");
	});

	it("formats negative values with a leading minus", () => {
		expect(normalize(formatCurrency("-5"))).toBe("-S/ 5.00");
	});

	it("falls back to S/ 0.00 when the value cannot be parsed", () => {
		expect(formatCurrency("")).toBe("S/ 0.00");
		expect(formatCurrency("abc")).toBe("S/ 0.00");
		expect(formatCurrency("not a number")).toBe("S/ 0.00");
	});

	it("parses with parseFloat semantics, stopping at the first invalid character", () => {
		expect(normalize(formatCurrency("12.5abc"))).toBe("S/ 12.50");
		expect(normalize(formatCurrency("1,234.56"))).toBe("S/ 1.00");
	});
});
