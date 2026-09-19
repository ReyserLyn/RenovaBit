import { describe, expect, it } from "bun:test";
import {
	addReviewReason,
	hasReviewReason,
	parseReviewReasons,
	REVIEW_REASONS,
	recomputeReviewReasons,
	removeReviewReason,
} from "../review-reasons";

describe("parseReviewReasons", () => {
	it("splits, trims and drops empty entries", () => {
		expect(parseReviewReasons("Sin imagen;  Sin marca ;;")).toEqual(["Sin imagen", "Sin marca"]);
		expect(parseReviewReasons(null)).toEqual([]);
		expect(parseReviewReasons("")).toEqual([]);
	});
});

describe("hasReviewReason", () => {
	it("finds a reason among many", () => {
		expect(hasReviewReason("Sin marca; IA no confia en datos", REVIEW_REASONS.missingBrand)).toBe(
			true,
		);
		expect(hasReviewReason("IA no confia en datos", REVIEW_REASONS.missingBrand)).toBe(false);
	});
});

describe("addReviewReason", () => {
	it("appends once, preserving the order", () => {
		expect(addReviewReason(null, REVIEW_REASONS.missingImage)).toBe("Sin imagen");
		expect(addReviewReason("Sin imagen", REVIEW_REASONS.missingImage)).toBe("Sin imagen");
		expect(addReviewReason("Sin marca", REVIEW_REASONS.missingImage)).toBe("Sin marca; Sin imagen");
	});
});

describe("removeReviewReason", () => {
	it("removes and returns null when nothing is left", () => {
		expect(removeReviewReason("Sin marca; Sin imagen", REVIEW_REASONS.missingBrand)).toBe(
			"Sin imagen",
		);
		expect(removeReviewReason("Sin marca", REVIEW_REASONS.missingBrand)).toBeNull();
		expect(removeReviewReason(null, REVIEW_REASONS.missingBrand)).toBeNull();
	});
});

describe("recomputeReviewReasons", () => {
	const fixed = { hasBrand: true, hasCategory: true, hasImage: true };

	it("clears reasons whose cause no longer applies", () => {
		const result = recomputeReviewReasons("Sin marca; Sin categoria; Sin imagen", fixed);
		expect(result).toEqual({ needsReview: false, reviewReason: null });
	});

	it("keeps the reasons that still apply", () => {
		const result = recomputeReviewReasons("Sin marca; IA no confia en datos", {
			...fixed,
			hasBrand: false,
		});
		expect(result.needsReview).toBe(true);
		expect(result.reviewReason).toBe("Sin marca; IA no confia en datos");
	});

	it("clears the model-confidence and duplicate reasons once a human reviewed it", () => {
		const result = recomputeReviewReasons("IA no confia en datos; Posible duplicado", {
			...fixed,
			reviewedByAdmin: true,
		});
		expect(result).toEqual({ needsReview: false, reviewReason: null });
	});

	it("leaves an empty reason set alone", () => {
		expect(recomputeReviewReasons(null, fixed)).toEqual({
			needsReview: false,
			reviewReason: null,
		});
	});
});
