import { describe, expect, it } from "bun:test";
import { PRODUCT_NAME_MAX, suffixProductName } from "../product-name";

describe("suffixProductName", () => {
	it("appends the provider id so the unique name does not collide", () => {
		expect(suffixProductName("Monitor Gamer Xiaomi G24I", "10348")).toBe(
			"Monitor Gamer Xiaomi G24I (10348)",
		);
	});

	it("keeps the result inside the column limit", () => {
		const result = suffixProductName("X".repeat(400), "9757");
		expect(result.length).toBeLessThanOrEqual(PRODUCT_NAME_MAX);
		expect(result.endsWith(" (9757)")).toBe(true);
	});

	it("does not cut mid-suffix when the base is too long", () => {
		const result = suffixProductName("A".repeat(PRODUCT_NAME_MAX), "abc-123");
		expect(result.endsWith(" (abc-123)")).toBe(true);
	});
});
