import { describe, expect, it } from "bun:test";
import { toApiValue } from "../string";

describe("toApiValue", () => {
	it("trims a meaningful value", () => {
		expect(toApiValue("  keyboard  ")).toBe("keyboard");
	});

	it("returns undefined for empty or whitespace-only values", () => {
		expect(toApiValue("")).toBeUndefined();
		expect(toApiValue("   ")).toBeUndefined();
	});

	it("keeps internal whitespace intact", () => {
		expect(toApiValue("  pro  keyboard  ")).toBe("pro  keyboard");
	});
});
