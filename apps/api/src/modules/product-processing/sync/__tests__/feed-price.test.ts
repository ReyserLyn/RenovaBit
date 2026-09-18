import { describe, expect, it } from "bun:test";
import { isInvalidFeedPrice, isPlaceholderPrice, parseFeedPrice } from "../feed-price";

describe("parseFeedPrice", () => {
	it("accepts a normal price", () => {
		expect(parseFeedPrice("1500.00")).toBe(1500);
	});

	it("accepts a price exactly at the ceiling", () => {
		expect(parseFeedPrice("50000")).toBe(50_000);
	});

	it("rejects feed anomalies above the ceiling", () => {
		expect(parseFeedPrice("50000.01")).toBeNull();
		expect(parseFeedPrice("10000000")).toBeNull();
		expect(parseFeedPrice("100000000.00")).toBeNull();
	});

	it("rejects zero, negative and unparseable values", () => {
		expect(parseFeedPrice("0")).toBeNull();
		expect(parseFeedPrice("-5")).toBeNull();
		expect(parseFeedPrice("abc")).toBeNull();
		expect(parseFeedPrice("")).toBeNull();
	});
});

describe("isPlaceholderPrice", () => {
	it("detects all-nines placeholders and the '2' marker", () => {
		expect(isPlaceholderPrice("9999")).toBe(true);
		expect(isPlaceholderPrice("99999.00")).toBe(true);
		expect(isPlaceholderPrice("2")).toBe(true);
	});

	it("does not flag real prices", () => {
		expect(isPlaceholderPrice("1500.00")).toBe(false);
		expect(isPlaceholderPrice("299")).toBe(false);
	});
});

describe("isInvalidFeedPrice", () => {
	it("flags out-of-range, placeholder and negative prices", () => {
		expect(isInvalidFeedPrice("100000000.00")).toBe(true);
		expect(isInvalidFeedPrice("9999")).toBe(true);
		expect(isInvalidFeedPrice("-3")).toBe(true);
	});

	it("passes normal prices through", () => {
		expect(isInvalidFeedPrice("1500.00")).toBe(false);
		expect(isInvalidFeedPrice("50000")).toBe(false);
	});
});
