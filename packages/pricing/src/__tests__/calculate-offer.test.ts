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

describe("applyOfferToProduct — best offer wins (no stacking)", () => {
	it("applies only the largest discount when offers overlap", () => {
		// 60% and 50% active: the 60% wins, they do NOT sum to 110%
		const result = applyOfferToProduct(
			100,
			[{ discountValue: 60 }, { discountValue: 50 }],
			"customer",
		);
		expect(result.discountedPrice).toBe(40);
		expect(result.totalDiscount).toBe(60);
	});

	it("allows a single offer up to 100% off", () => {
		const result = applyOfferToProduct(100, [{ discountValue: 100 }], "customer");
		expect(result.discountedPrice).toBe(0);
		expect(result.totalDiscount).toBe(100);
	});

	it("caps the best discount at 100%", () => {
		const result = applyOfferToProduct(100, [{ discountValue: 150 }], "customer");
		expect(result.discountedPrice).toBe(0);
		expect(result.totalDiscount).toBe(100);
	});

	it("ignores lower overlapping offers entirely", () => {
		// 30% beats 20%: the price uses only the 30%
		const result = applyOfferToProduct(
			100,
			[{ discountValue: 30 }, { discountValue: 20 }],
			"customer",
		);
		expect(result.discountedPrice).toBe(70);
		expect(result.totalDiscount).toBe(30);
	});
});
