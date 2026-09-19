import { describe, expect, it } from "bun:test";
import {
	formatDateTime,
	formatDateTimeSeconds,
	formatDuration,
	formatDurationMs,
	formatShortDateTime,
	formatTime,
} from "../format-date";

/** Mid-year instant: its calendar year is stable across every timezone. */
const ISO = "2026-06-15T12:00:00Z";

describe("invalid input handling", () => {
	it("returns a dash for unparseable timestamps", () => {
		expect(formatDateTime("not-a-date")).toBe("—");
		expect(formatDateTime("")).toBe("—");
		expect(formatDateTimeSeconds("not-a-date")).toBe("—");
		expect(formatTime("not-a-date")).toBe("—");
		expect(formatShortDateTime("not-a-date")).toBe("—");
	});

	it("returns a dash for an invalid Date instance", () => {
		expect(formatShortDateTime(new Date(Number.NaN))).toBe("—");
	});
});

describe("valid input handling", () => {
	it("formats a valid timestamp without falling back to the dash", () => {
		const formatted = formatDateTime(ISO);

		expect(formatted).not.toBe("—");
		expect(formatted).toContain("2026");
	});

	it("includes seconds only in the seconds variant", () => {
		expect(formatDateTimeSeconds(ISO)).not.toBe(formatDateTime(ISO));
	});

	it("formats the same instant identically from a string and a Date", () => {
		expect(formatShortDateTime(ISO)).toBe(formatShortDateTime(new Date(ISO)));
	});

	it("renders a time-only value", () => {
		expect(formatTime(ISO)).toMatch(/^\d{2}:\d{2}/);
	});
});

describe("formatDurationMs", () => {
	it("renders seconds below one minute", () => {
		expect(formatDurationMs(0)).toBe("0s");
		expect(formatDurationMs(1000)).toBe("1s");
		expect(formatDurationMs(59_400)).toBe("59s");
	});

	it("rounds to the nearest second", () => {
		expect(formatDurationMs(999)).toBe("1s");
		expect(formatDurationMs(90_500)).toBe("1m 31s");
	});

	it("renders minutes and hours", () => {
		expect(formatDurationMs(60_000)).toBe("1m 0s");
		expect(formatDurationMs(3_600_000)).toBe("1h 0m");
		expect(formatDurationMs(5_430_000)).toBe("1h 30m");
	});

	it("collapses non-positive, NaN and infinite values to zero", () => {
		expect(formatDurationMs(-1)).toBe("0s");
		expect(formatDurationMs(Number.NaN)).toBe("0s");
		expect(formatDurationMs(Number.POSITIVE_INFINITY)).toBe("0s");
	});
});

describe("formatDuration", () => {
	it("renders the difference between two timestamps", () => {
		expect(formatDuration("2026-01-01T00:00:00Z", "2026-01-01T00:02:30Z")).toBe("2m 30s");
	});

	it("collapses invalid timestamps to zero", () => {
		expect(formatDuration("not-a-date", "also-not-a-date")).toBe("0s");
	});
});
