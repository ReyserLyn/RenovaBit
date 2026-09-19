import { describe, expect, it } from "bun:test";
import { shouldCheckProviderImage } from "../image-policy";

const NOW = new Date("2026-09-19T12:00:00Z");

describe("shouldCheckProviderImage", () => {
	it("checks when the image was never fetched", () => {
		expect(
			shouldCheckProviderImage(
				{ rawImageUrl: null, rawImageHash: null, imageCheckedAt: null },
				NOW,
			),
		).toBe(true);
		expect(
			shouldCheckProviderImage(
				{ rawImageUrl: "https://cdn/x.png", rawImageHash: null, imageCheckedAt: null },
				NOW,
			),
		).toBe(true);
	});

	it("skips items the supplier has no image for until the window passes", () => {
		// The check was done and found nothing: do not hammer it every run.
		expect(
			shouldCheckProviderImage(
				{
					rawImageUrl: null,
					rawImageHash: null,
					imageCheckedAt: new Date("2026-09-19T06:00:00Z"),
				},
				NOW,
			),
		).toBe(false);
		expect(
			shouldCheckProviderImage(
				{
					rawImageUrl: null,
					rawImageHash: null,
					imageCheckedAt: new Date("2026-09-18T20:00:00Z"),
				},
				NOW,
			),
		).toBe(true);
	});

	it("skips the check inside the re-check window", () => {
		expect(
			shouldCheckProviderImage(
				{
					rawImageUrl: "https://cdn/x.png",
					rawImageHash: "abc",
					imageCheckedAt: new Date("2026-09-19T06:00:00Z"),
				},
				NOW,
			),
		).toBe(false);
	});

	it("re-checks once the window has passed", () => {
		expect(
			shouldCheckProviderImage(
				{
					rawImageUrl: "https://cdn/x.png",
					rawImageHash: "abc",
					imageCheckedAt: new Date("2026-09-18T20:00:00Z"),
				},
				NOW,
			),
		).toBe(true);
	});

	it("seeds the timestamp for legacy rows that have none", () => {
		expect(
			shouldCheckProviderImage(
				{ rawImageUrl: "https://cdn/x.png", rawImageHash: "abc", imageCheckedAt: null },
				NOW,
			),
		).toBe(true);
	});
});
