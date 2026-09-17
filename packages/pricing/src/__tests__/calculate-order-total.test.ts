import { describe, expect, it } from "bun:test";
import { calculateOrderTotal } from "../calculate-order-total";

describe("calculateOrderTotal — role guard", () => {
	const items = [
		{
			salePrice: 100,
			quantity: 2,
			offers: [
				{
					id: "offer-1",
					discountValue: 20,
				},
			],
		},
	];

	it("applies offer discount for customer role", () => {
		const result = calculateOrderTotal({ items }, "customer");
		expect(result.offerDiscount).toBe(40); // 20% of 100 = 20 × 2 qty
		expect(result.subtotal).toBe(200);
		expect(result.total).toBe(160);
	});

	it("applies zero offer discount for admin role", () => {
		const result = calculateOrderTotal({ items }, "admin");
		expect(result.offerDiscount).toBe(0);
		expect(result.subtotal).toBe(200);
		expect(result.total).toBe(200);
	});

	it("applies offer discount for distributor role when offer is better than tier price", () => {
		const result = calculateOrderTotal({ items }, "distributor");
		// 20% off 100 = 80, which beats the tier price of 100
		expect(result.offerDiscount).toBe(40); // 20% of 100 = 20 × 2 qty
		expect(result.subtotal).toBe(200);
		expect(result.total).toBe(160);
	});

	it("returns tier price when distributor has no offers", () => {
		const noOfferItems = [
			{
				salePrice: 100,
				quantity: 2,
				offers: [],
			},
		];
		const result = calculateOrderTotal({ items: noOfferItems }, "distributor");
		expect(result.offerDiscount).toBe(0);
		expect(result.subtotal).toBe(200);
		expect(result.total).toBe(200);
	});
});
