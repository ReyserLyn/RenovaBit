import { describe, expect, it } from "bun:test";
import { formatReportDuration, normalizeSyncStats } from "../lib/sync-stats";

describe("normalizeSyncStats", () => {
	it("keeps every rich field from the nested shape", () => {
		const normalized = normalizeSyncStats({
			failedItems: [
				{ providerId: "provider-a", reason: "timeout" },
				{ providerId: "provider-b", reason: "404" },
			],
			ai: { calls: 2, failed: 1, costUsd: 0.5 },
			images: { checked: 4, missing: 1 },
			zeroingSkipped: true,
			blacklistedRemoved: 3,
			unavailableMarked: 2,
			durationMs: 1000,
		});

		expect(normalized).toEqual({
			aiCostUsd: 0.5,
			aiCalls: 2,
			aiFailed: 1,
			imagesChecked: 4,
			imagesMissing: 1,
			durationMs: 1000,
			failedCount: 2,
			failedReasons: ["provider-a: timeout", "provider-b: 404"],
			zeroingSkipped: true,
			blacklistedRemoved: 3,
			unavailableMarked: 2,
		});
	});

	it("keeps every field from the flat notification shape", () => {
		const normalized = normalizeSyncStats({
			failedCount: 3,
			failedSample: "provider-a: timeout · provider-b: 404",
			aiCalls: 2,
			aiFailed: 1,
			aiCostUsd: 0.5,
			imagesChecked: 4,
			imagesMissing: 1,
			durationMs: 1000,
		});

		expect(normalized.failedCount).toBe(3);
		expect(normalized.failedReasons).toEqual(["provider-a: timeout", "provider-b: 404"]);
		expect(normalized.aiCostUsd).toBe(0.5);
		expect(normalized.imagesChecked).toBe(4);
		expect(normalized.zeroingSkipped).toBeNull();
	});

	it("prefers the nested shape when both shapes are present", () => {
		const normalized = normalizeSyncStats({
			failedItems: [{ providerId: "nested", reason: "wins" }],
			failedCount: 9,
			ai: { calls: 1, failed: 0, costUsd: 0.1 },
			aiCostUsd: 9,
			zeroingSkipped: false,
		});

		expect(normalized.failedCount).toBe(1);
		expect(normalized.failedReasons).toEqual(["nested: wins"]);
		expect(normalized.aiCostUsd).toBe(0.1);
	});

	it("falls back to the flat values when failedItems is empty", () => {
		expect(normalizeSyncStats({ failedItems: [], failedCount: 3 }).failedCount).toBe(3);
		expect(
			normalizeSyncStats({ failedItems: [], failedSample: "a: b · c: d" }).failedReasons,
		).toEqual(["a: b", "c: d"]);
	});

	it("does not fabricate values for missing optional stats", () => {
		const normalized = normalizeSyncStats({});

		expect(normalized.aiCostUsd).toBeNull();
		expect(normalized.aiCalls).toBeNull();
		expect(normalized.imagesChecked).toBeNull();
		expect(normalized.imagesMissing).toBeNull();
		expect(normalized.durationMs).toBeNull();
		expect(normalized.zeroingSkipped).toBeNull();
		expect(normalized.blacklistedRemoved).toBeNull();
		expect(normalized.unavailableMarked).toBeNull();
		expect(normalized.failedCount).toBe(0);
		expect(normalized.failedReasons).toEqual([]);
	});

	it("keeps an explicit zeroingSkipped = false as false, never as null", () => {
		expect(normalizeSyncStats({ zeroingSkipped: false }).zeroingSkipped).toBe(false);
	});
});

describe("formatReportDuration", () => {
	const completed = {
		status: "completed",
		startedAt: "2026-01-01T00:00:00Z",
		completedAt: "2026-01-01T00:02:30Z",
	};

	it("labels a running report as in progress even when a stored duration exists", () => {
		const running = { ...completed, status: "running", stats: { durationMs: 5000 } };

		expect(formatReportDuration(running)).toBe("En curso");
	});

	it("prefers the stored duration over the date difference", () => {
		expect(formatReportDuration({ ...completed, stats: { durationMs: 5000 } })).toBe("5s");
	});

	it("falls back to the date difference when there is no stored duration", () => {
		expect(formatReportDuration({ ...completed, stats: {} })).toBe("2m 30s");
	});

	it("falls back to the date difference when the stored duration is zero", () => {
		expect(formatReportDuration({ ...completed, stats: { durationMs: 0 } })).toBe("2m 30s");
	});

	it("returns a dash when there is neither duration nor completion date", () => {
		const unfinished = { ...completed, completedAt: null, stats: {} };

		expect(formatReportDuration(unfinished)).toBe("—");
	});
});
