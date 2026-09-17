import { describe, expect, it } from "bun:test";
import { applyOfferToProduct } from "../calculate-offer";

describe("applyOfferToProduct — role guard", () => {
	const basePrice = 100;
	const offers = [
		{
			id: "offer-1",
			discountValue: 20,
		},
	];

	it("applies offer discount when role is customer", () => {
		const result = applyOfferToProduct(basePrice, offers, "customer");
		expect(result.discountedPrice).toBe(80);
		expect(result.totalDiscount).toBe(20);
	});

	it("returns unchanged price when role is admin", () => {
		const result = applyOfferToProduct(basePrice, offers, "admin");
		expect(result.discountedPrice).toBe(basePrice);
		expect(result.totalDiscount).toBe(0);
	});

	it("returns unchanged price when role is customer but no offers", () => {
		const result = applyOfferToProduct(basePrice, [], "customer");
		expect(result.discountedPrice).toBe(basePrice);
		expect(result.totalDiscount).toBe(0);
	});

	it("applies offers for customer role", () => {
		const result = applyOfferToProduct(basePrice, offers, "customer");
		expect(result.discountedPrice).toBe(80);
	});

	it("handles edge case: salePrice of 0", () => {
		const result = applyOfferToProduct(0, offers, "customer");
		expect(result.discountedPrice).toBe(0);
		expect(result.totalDiscount).toBe(0);
	});

	it("handles edge case: negative salePrice", () => {
		const result = applyOfferToProduct(-10, offers, "customer");
		expect(result.discountedPrice).toBe(0);
		expect(result.totalDiscount).toBe(0);
	});
});

describe("applyOfferToProduct — stacked offers cap (100%)", () => {
	it("caps stacked offers at 100% of salePrice", () => {
		// 60% + 50% = 110%, capped at 100% → free product
		const result = applyOfferToProduct(
			100,
			[{ discountValue: 60 }, { discountValue: 50 }],
			"customer",
		);
		expect(result.discountedPrice).toBe(0);
		expect(result.totalDiscount).toBe(100);
	});

	it("allows a single offer up to 100% off", () => {
		const result = applyOfferToProduct(100, [{ discountValue: 100 }], "customer");
		expect(result.discountedPrice).toBe(0);
		expect(result.totalDiscount).toBe(100);
	});

	it("does not cap below 100% when stacked offers total less", () => {
		// 30% + 20% = 50%, well under the 100% cap
		const result = applyOfferToProduct(
			100,
			[{ discountValue: 30 }, { discountValue: 20 }],
			"customer",
		);
		expect(result.discountedPrice).toBe(50);
		expect(result.totalDiscount).toBe(50);
	});
});
