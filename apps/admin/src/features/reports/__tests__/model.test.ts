import { describe, expect, it } from "bun:test";
import { formatChangeValue } from "../model";

describe("formatChangeValue", () => {
	it("renders missing values as a dash", () => {
		expect(formatChangeValue(null, undefined)).toBe("— → —");
	});

	it("renders price changes with the currency prefix", () => {
		expect(formatChangeValue({ price: "12.34" }, { price: "9.99" })).toBe("S/ 12.34 → S/ 9.99");
	});

	it("renders stock changes as plain numbers", () => {
		expect(formatChangeValue(3, { stock: 0 })).toBe("3 → 0");
	});

	it("translates managedBy values", () => {
		expect(formatChangeValue({ managedBy: "manual" }, { managedBy: "provider" })).toBe(
			"Manual → Proveedor",
		);
		expect(formatChangeValue({ managedBy: "weird" }, null)).toBe("weird → —");
	});

	it("abbreviates hashes to seven characters", () => {
		expect(formatChangeValue({ hash: "abcdef123456" }, null)).toBe("#abcdef1 → —");
	});

	it("translates detectada booleans", () => {
		expect(formatChangeValue({ detectada: true }, { detectada: false })).toBe("Sí → No");
	});

	it("falls back to JSON for unknown objects", () => {
		expect(formatChangeValue({ other: 1 }, [1, 2])).toBe('{"other":1} → [1,2]');
	});

	it("stringifies primitives", () => {
		expect(formatChangeValue("old", 0)).toBe("old → 0");
	});
});
