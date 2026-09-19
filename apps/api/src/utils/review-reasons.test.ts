/**
 * Review-reason reconciliation: saving a product must clear the reasons whose
 * cause is already fixed (production once kept 16 products hidden behind a
 * stale "Sin marca" after the brand was set). Reasons that do NOT depend on
 * the product form — "Precio inválido o fuera de rango" comes from the
 * provider feed — must survive the save; only a new sync can clear those.
 */
import { describe, expect, it } from "bun:test";
import { REVIEW_REASONS, recomputeReviewReasons } from "./review-reasons";

const allFixed = {
	hasBrand: true,
	hasCategory: true,
	hasImage: true,
	reviewedByAdmin: true,
} as const;

describe("recomputeReviewReasons", () => {
	it("clears every reason whose cause is already fixed", () => {
		const current = [
			REVIEW_REASONS.missingBrand,
			REVIEW_REASONS.missingCategory,
			REVIEW_REASONS.missingImage,
		].join("; ");

		expect(recomputeReviewReasons(current, allFixed)).toEqual({
			needsReview: false,
			reviewReason: null,
		});
	});

	it("keeps a reason whose cause is still missing", () => {
		const result = recomputeReviewReasons(REVIEW_REASONS.missingBrand, {
			hasBrand: false,
			hasCategory: true,
			hasImage: true,
		});

		expect(result).toEqual({
			needsReview: true,
			reviewReason: REVIEW_REASONS.missingBrand,
		});
	});

	it("clears the AI-doubt and duplicate warnings after a human save", () => {
		const current = [REVIEW_REASONS.aiUnsure, REVIEW_REASONS.duplicate].join("; ");

		expect(recomputeReviewReasons(current, allFixed)).toEqual({
			needsReview: false,
			reviewReason: null,
		});
	});

	it("keeps the invalid-price reason: only a new provider sync can clear it", () => {
		expect(recomputeReviewReasons(REVIEW_REASONS.invalidPrice, allFixed)).toEqual({
			needsReview: true,
			reviewReason: REVIEW_REASONS.invalidPrice,
		});
	});

	it("preserves unknown reasons instead of silently dropping them", () => {
		const result = recomputeReviewReasons("Motivo desconocido", {
			hasBrand: true,
			hasCategory: true,
			hasImage: true,
		});

		expect(result).toEqual({
			needsReview: true,
			reviewReason: "Motivo desconocido",
		});
	});
});
