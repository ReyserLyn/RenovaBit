import { describe, expect, it } from "bun:test";
import { isSyncStatusFilter } from "../model";

describe("isSyncStatusFilter", () => {
	it("accepts every declared status filter", () => {
		expect(isSyncStatusFilter("all")).toBe(true);
		expect(isSyncStatusFilter("running")).toBe(true);
		expect(isSyncStatusFilter("completed")).toBe(true);
		expect(isSyncStatusFilter("failed")).toBe(true);
	});

	it("rejects unknown and missing values", () => {
		expect(isSyncStatusFilter("pending")).toBe(false);
		expect(isSyncStatusFilter("")).toBe(false);
		expect(isSyncStatusFilter(null)).toBe(false);
		expect(isSyncStatusFilter(undefined)).toBe(false);
	});
});
