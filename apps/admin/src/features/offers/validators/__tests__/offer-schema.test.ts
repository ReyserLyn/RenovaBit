import { describe, expect, it } from "bun:test";
import { OFFER_DESCRIPTION_MAX, OFFER_SLUG_MAX, offerFormSchema } from "../offer-schema";

const validOffer = {
	name: "  Cyber Monday  ",
	discountValue: 10,
};

describe("offerFormSchema", () => {
	it("accepts a minimal offer and trims the name", () => {
		const parsed = offerFormSchema.parse(validOffer);

		expect(parsed.name).toBe("Cyber Monday");
	});

	it("requires a non-empty name", () => {
		expect(offerFormSchema.safeParse({ ...validOffer, name: "   " }).success).toBe(false);
	});

	it("rejects a name longer than 100 characters", () => {
		expect(offerFormSchema.safeParse({ ...validOffer, name: "x".repeat(101) }).success).toBe(false);
	});

	it("accepts discounts from 0.01 to 100 inclusive", () => {
		expect(offerFormSchema.safeParse({ ...validOffer, discountValue: 0.01 }).success).toBe(true);
		expect(offerFormSchema.safeParse({ ...validOffer, discountValue: 100 }).success).toBe(true);
	});

	it("rejects discounts outside (0, 100]", () => {
		expect(offerFormSchema.safeParse({ ...validOffer, discountValue: 0 }).success).toBe(false);
		expect(offerFormSchema.safeParse({ ...validOffer, discountValue: 100.01 }).success).toBe(false);
		expect(offerFormSchema.safeParse({ ...validOffer, discountValue: -5 }).success).toBe(false);
	});

	it("caps the optional slug and description", () => {
		expect(
			offerFormSchema.safeParse({ ...validOffer, slug: "x".repeat(OFFER_SLUG_MAX) }).success,
		).toBe(true);
		expect(
			offerFormSchema.safeParse({ ...validOffer, slug: "x".repeat(OFFER_SLUG_MAX + 1) }).success,
		).toBe(false);
		expect(
			offerFormSchema.safeParse({
				...validOffer,
				description: "x".repeat(OFFER_DESCRIPTION_MAX + 1),
			}).success,
		).toBe(false);
	});

	it("expects Date values for startsAt/endsAt, not ISO strings", () => {
		const withDate = { ...validOffer, startsAt: new Date("2026-01-01T00:00:00Z") };
		const withString = { ...validOffer, startsAt: "2026-01-01T00:00:00.000Z" };

		expect(offerFormSchema.safeParse(withDate).success).toBe(true);
		expect(offerFormSchema.safeParse(withString).success).toBe(false);
	});

	it("accepts an empty productIds array", () => {
		expect(offerFormSchema.safeParse({ ...validOffer, productIds: [] }).success).toBe(true);
	});
});
