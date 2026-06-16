import { describe, expect, it } from "bun:test";
import { buildPrefixTsQuery, escapeLikePattern } from "./prefix-tsquery";

describe("buildPrefixTsQuery", () => {
	it("returns empty string for empty input", () => {
		expect(buildPrefixTsQuery("")).toBe("");
	});

	it("returns empty string for whitespace-only input", () => {
		expect(buildPrefixTsQuery("   ")).toBe("");
	});

	it("appends :* to a single word", () => {
		expect(buildPrefixTsQuery("3200")).toBe("3200:*");
	});

	it("joins multiple words with &", () => {
		expect(buildPrefixTsQuery("rtx 4060")).toBe("rtx:* & 4060:*");
	});

	it("handles multiple spaces between words", () => {
		expect(buildPrefixTsQuery("amd   ryzen")).toBe("amd:* & ryzen:*");
	});

	it("strips backslash characters", () => {
		const result = buildPrefixTsQuery("test\\inject");
		expect(result).not.toContain("\\");
		expect(result).toBe("test:* & inject:*");
	});

	it("strips tsquery special characters", () => {
		// & | ! ( ) : * < > are stripped
		const result = buildPrefixTsQuery("hello&world|test");
		expect(result).toBe("hello:* & world:* & test:*");
	});

	it("strips parentheses", () => {
		const result = buildPrefixTsQuery("(rtx 4060)");
		expect(result).toBe("rtx:* & 4060:*");
	});

	it("strips colon-asterisk combinations", () => {
		const result = buildPrefixTsQuery("foo:*");
		expect(result).toBe("foo:*");
	});

	it("preserves Spanish accents", () => {
		expect(buildPrefixTsQuery("construcción")).toBe("construcción:*");
		expect(buildPrefixTsQuery("rápido fácil")).toBe("rápido:* & fácil:*");
	});

	it("returns empty string when all chars are stripped", () => {
		expect(buildPrefixTsQuery("&|!():*<>")).toBe("");
	});

	it("trims leading and trailing whitespace", () => {
		expect(buildPrefixTsQuery("  monitor  ")).toBe("monitor:*");
	});
});

describe("escapeLikePattern", () => {
	it("escapes percent signs", () => {
		expect(escapeLikePattern("100%")).toBe("100\\%");
	});

	it("escapes underscores", () => {
		expect(escapeLikePattern("test_sku")).toBe("test\\_sku");
	});

	it("escapes backslashes", () => {
		expect(escapeLikePattern("path\\to")).toBe("path\\\\to");
	});

	it("escapes multiple special chars", () => {
		expect(escapeLikePattern("100%_test\\sku")).toBe("100\\%\\_test\\\\sku");
	});

	it("returns empty string unchanged", () => {
		expect(escapeLikePattern("")).toBe("");
	});

	it("does not escape normal alphanumeric characters", () => {
		expect(escapeLikePattern("hello123")).toBe("hello123");
	});

	it("handles mixed safe and special characters", () => {
		expect(escapeLikePattern("abc_def%ghi")).toBe("abc\\_def\\%ghi");
	});

	it("handles consecutive special characters", () => {
		expect(escapeLikePattern("%_\\")).toBe("\\%\\_\\\\");
	});
});
