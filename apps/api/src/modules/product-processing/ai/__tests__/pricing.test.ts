import { describe, expect, it } from "bun:test";
import { AI_PRICES, estimateCostUsd } from "../pricing";

describe("estimateCostUsd", () => {
	it("charges nothing for no usage", () => {
		expect(estimateCostUsd({ inputTokens: 0, outputTokens: 0 })).toBe(0);
	});

	it("prices input and output separately", () => {
		const oneMillionEach = estimateCostUsd({ inputTokens: 1_000_000, outputTokens: 1_000_000 });
		expect(oneMillionEach).toBeCloseTo(AI_PRICES.inputPerMillion + AI_PRICES.outputPerMillion, 5);
	});

	it("keeps a single extraction under a tenth of a cent", () => {
		const perProduct = estimateCostUsd({ inputTokens: 1500, outputTokens: 300 });
		expect(perProduct).toBeGreaterThan(0);
		expect(perProduct).toBeLessThan(0.001);
	});
});
