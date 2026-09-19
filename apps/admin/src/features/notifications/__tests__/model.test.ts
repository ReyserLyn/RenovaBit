import { describe, expect, it } from "bun:test";
import {
	isSortOption,
	notificationDataSchema,
	notificationSchema,
	syncStatsSchema,
} from "../model";

/** The six counters every stats shape must carry. */
const counters = {
	processed: 10,
	created: 1,
	updated: 2,
	unchanged: 6,
	errors: 1,
	outOfStock: 0,
};

describe("syncStatsSchema", () => {
	it("preserves every rich field of the nested SyncStats shape", () => {
		const stats = syncStatsSchema.parse({
			...counters,
			failedItems: [{ providerId: "provider-a", reason: "timeout" }],
			ai: { calls: 3, failed: 1, inputTokens: 120, outputTokens: 80, costUsd: 0.1234 },
			images: { checked: 8, processed: 7, missing: 1 },
			unavailableMarked: 4,
			zeroingSkipped: true,
			blacklistedRemoved: 2,
			durationMs: 4200,
		});

		expect(stats.failedItems).toEqual([{ providerId: "provider-a", reason: "timeout" }]);
		expect(stats.ai).toEqual({
			calls: 3,
			failed: 1,
			inputTokens: 120,
			outputTokens: 80,
			costUsd: 0.1234,
		});
		expect(stats.images).toEqual({ checked: 8, processed: 7, missing: 1 });
		expect(stats.unavailableMarked).toBe(4);
		expect(stats.zeroingSkipped).toBe(true);
		expect(stats.blacklistedRemoved).toBe(2);
		expect(stats.durationMs).toBe(4200);
	});

	it("preserves every field of the flat notification payload shape", () => {
		const stats = syncStatsSchema.parse({
			...counters,
			failedCount: 3,
			failedSample: "provider-a: timeout · provider-b: 404",
			aiCalls: 3,
			aiFailed: 1,
			aiCostUsd: 0.5,
			imagesChecked: 8,
			imagesProcessed: 7,
			imagesMissing: 1,
			durationMs: 1000,
		});

		expect(stats.failedCount).toBe(3);
		expect(stats.failedSample).toBe("provider-a: timeout · provider-b: 404");
		expect(stats.aiCostUsd).toBe(0.5);
		expect(stats.imagesChecked).toBe(8);
		expect(stats.imagesMissing).toBe(1);
		expect(stats.durationMs).toBe(1000);
		expect(stats.failedItems).toBeUndefined();
		expect(stats.ai).toBeUndefined();
	});

	it("accepts the six base counters alone", () => {
		const stats = syncStatsSchema.parse(counters);

		expect(stats.durationMs).toBeUndefined();
		expect(stats.zeroingSkipped).toBeUndefined();
	});

	it("fails safely on malformed counters instead of throwing", () => {
		const result = syncStatsSchema.safeParse({ ...counters, processed: "ten" });

		expect(result.success).toBe(false);
	});

	it("fails safely on an unrelated payload", () => {
		expect(syncStatsSchema.safeParse({ kind: "unknown" }).success).toBe(false);
	});

	it("rejects a failed item missing its reason", () => {
		const result = syncStatsSchema.safeParse({
			...counters,
			failedItems: [{ providerId: "provider-a" }],
		});

		expect(result.success).toBe(false);
	});
});

describe("notificationDataSchema", () => {
	it("parses the sync_failed variant carrying errorMessage and reportId", () => {
		const data = notificationDataSchema.parse({
			trigger: "sync_failed",
			reportId: "report-1",
			jobId: "job-1",
			errorMessage: "Feed request timed out",
			completedAt: "2026-05-01T10:01:00Z",
		});

		expect(data.trigger).toBe("sync_failed");
		expect(data.reportId).toBe("report-1");
		expect(data.errorMessage).toBe("Feed request timed out");
	});

	it("leaves errorMessage undefined for a successful sync", () => {
		const data = notificationDataSchema.parse({ trigger: "sync_completed", stats: counters });

		expect(data.errorMessage).toBeUndefined();
		expect(data.stats?.processed).toBe(10);
	});

	it("normalizes Date timestamps to ISO strings and keeps string timestamps", () => {
		const data = notificationDataSchema.parse({
			startedAt: new Date("2026-05-01T10:00:00Z"),
			completedAt: "2026-05-01T10:01:00Z",
		});

		expect(data.startedAt).toBe("2026-05-01T10:00:00.000Z");
		expect(data.completedAt).toBe("2026-05-01T10:01:00Z");
	});

	it("accepts an empty object because every field is optional", () => {
		expect(notificationDataSchema.safeParse({}).success).toBe(true);
	});

	it("fails safely on non-object data", () => {
		expect(notificationDataSchema.safeParse(null).success).toBe(false);
		expect(notificationDataSchema.safeParse("not-an-object").success).toBe(false);
		expect(notificationDataSchema.safeParse(42).success).toBe(false);
	});

	it("fails safely when a timestamp has the wrong type", () => {
		expect(notificationDataSchema.safeParse({ startedAt: 123 }).success).toBe(false);
	});

	it("fails safely when stats do not match the schema", () => {
		expect(notificationDataSchema.safeParse({ stats: { processed: 1 } }).success).toBe(false);
	});
});

describe("notificationSchema", () => {
	const notification = {
		id: "notification-1",
		userId: "user-1",
		type: "sync_completed",
		title: "Sync finished",
		message: null,
		data: { trigger: "sync_completed" },
		isRead: false,
		createdAt: "2026-05-01T10:00:00Z",
		user: { id: "user-1", email: "user@example.com", username: null, displayUsername: null },
	};

	it("parses a full row and keeps data opaque", () => {
		const parsed = notificationSchema.parse(notification);

		expect(parsed.data).toEqual({ trigger: "sync_completed" });
		expect(parsed.user?.email).toBe("user@example.com");
	});

	it("accepts data = null and user = null", () => {
		const result = notificationSchema.safeParse({ ...notification, data: null, user: null });

		expect(result.success).toBe(true);
	});

	it("rejects a row without the required user key", () => {
		const { user: _user, ...withoutUser } = notification;

		expect(notificationSchema.safeParse(withoutUser).success).toBe(false);
	});
});

describe("isSortOption", () => {
	it("accepts every declared sort option", () => {
		expect(isSortOption("name-asc")).toBe(true);
		expect(isSortOption("name-desc")).toBe(true);
		expect(isSortOption("type")).toBe(true);
		expect(isSortOption("newest")).toBe(true);
	});

	it("rejects unknown and missing values", () => {
		expect(isSortOption("oldest")).toBe(false);
		expect(isSortOption("")).toBe(false);
		expect(isSortOption(null)).toBe(false);
		expect(isSortOption(undefined)).toBe(false);
	});
});
