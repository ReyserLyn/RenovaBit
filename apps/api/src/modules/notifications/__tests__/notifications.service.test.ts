/**
 * Notification payload builders — pure unit tests (no DB).
 *
 * The builders are the contract between the worker and the admin UI: if a rich
 * stat stops being projected, the operator silently loses it. These tests pin
 * the projection and the failure payload shape.
 */
import { describe, expect, it } from "bun:test";
import type { SyncStats } from "@renovabit/db/schema";
import { buildSyncFailedNotification, buildSyncNotification } from "../notifications.service";

const BASE_STATS: SyncStats = {
	processed: 10,
	created: 2,
	updated: 3,
	unchanged: 5,
	errors: 1,
	outOfStock: 0,
};

describe("buildSyncNotification", () => {
	it("flattens the rich stats into the primitive notification payload", () => {
		const payload = buildSyncNotification({
			reportId: "report-1",
			jobId: "job-1",
			trigger: "manual",
			stats: {
				...BASE_STATS,
				failedItems: [
					{ providerId: "P-1", reason: "Precio inválido" },
					{ providerId: "P-2", reason: "Timeout del proveedor" },
				],
				ai: { calls: 4, failed: 1, inputTokens: 100, outputTokens: 50, costUsd: 0.02 },
				images: { checked: 3, processed: 2, missing: 1 },
				unavailableMarked: 2,
				zeroingSkipped: true,
				blacklistedRemoved: 1,
				durationMs: 1234,
			},
			startedAt: "2026-01-01T00:00:00.000Z",
			completedAt: "2026-01-01T00:01:00.000Z",
		});

		expect(payload.type).toBe("sync_completed");
		expect(payload.title).toBe("Sincronización completada");
		expect(payload.data.stats).toMatchObject({
			processed: 10,
			created: 2,
			updated: 3,
			unchanged: 5,
			errors: 1,
			outOfStock: 0,
			failedCount: 2,
			aiCalls: 4,
			aiFailed: 1,
			aiCostUsd: 0.02,
			imagesChecked: 3,
			imagesProcessed: 2,
			imagesMissing: 1,
			durationMs: 1234,
			failedSample: "P-1: Precio inválido · P-2: Timeout del proveedor",
			unavailableMarked: 2,
			zeroingSkipped: true,
			blacklistedRemoved: 1,
		});
	});

	it("caps the failed sample and truncates long reasons", () => {
		const payload = buildSyncNotification({
			reportId: "report-2",
			jobId: undefined,
			trigger: "automatic",
			stats: {
				...BASE_STATS,
				failedItems: [
					{ providerId: "P-1", reason: "a".repeat(200) },
					{ providerId: "P-2", reason: "b" },
					{ providerId: "P-3", reason: "c" },
					{ providerId: "P-4", reason: "no debe viajar" },
				],
			},
			startedAt: "2026-01-01T00:00:00.000Z",
			completedAt: "2026-01-01T00:01:00.000Z",
		});

		const sample = payload.data.stats?.failedSample ?? "";
		expect(sample).not.toContain("P-4");
		expect(sample).toContain("…");
		expect(sample.length).toBeLessThan(400);
	});

	it("omits the failed sample when there are no failures", () => {
		const payload = buildSyncNotification({
			reportId: "report-3",
			jobId: "job-3",
			trigger: "automatic",
			stats: BASE_STATS,
			startedAt: "2026-01-01T00:00:00.000Z",
			completedAt: "2026-01-01T00:01:00.000Z",
		});

		expect(payload.data.stats?.failedSample).toBeUndefined();
		expect(payload.data.stats?.failedCount).toBe(0);
	});
});

describe("buildSyncFailedNotification", () => {
	it("builds a sync_failed payload that keeps the error and the report id", () => {
		const payload = buildSyncFailedNotification({
			reportId: "report-9",
			jobId: "job-9",
			trigger: "automatic",
			errorMessage: "El proveedor no respondió",
			completedAt: "2026-01-01T00:05:00.000Z",
		});

		expect(payload.type).toBe("sync_failed");
		expect(payload.title).toBe("Sincronización fallida");
		expect(payload.message).toContain("El proveedor no respondió");
		expect(payload.data).toEqual({
			reportId: "report-9",
			jobId: "job-9",
			trigger: "automatic",
			errorMessage: "El proveedor no respondió",
			completedAt: "2026-01-01T00:05:00.000Z",
		});
	});

	it("truncates the message preview but keeps the full error in data", () => {
		const longError = "x".repeat(600);

		const payload = buildSyncFailedNotification({
			trigger: "manual",
			errorMessage: longError,
			completedAt: "2026-01-01T00:05:00.000Z",
		});

		expect(payload.message).toContain("…");
		expect(payload.message.length).toBeLessThan(longError.length);
		expect(payload.data.errorMessage).toBe(longError);
		expect(payload.data.reportId).toBeUndefined();
	});
});
