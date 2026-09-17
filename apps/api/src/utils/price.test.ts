import { describe, expect, it } from "bun:test";
import { resolveSalePrice } from "./price";

const MARGIN_RULES = [{ minPrice: "0", maxPrice: "100000", customerPct: "30" }];

describe("resolveSalePrice", () => {
	it("uses the stored price for owner-managed products (no margins)", () => {
		const price = resolveSalePrice(
			{ managedBy: "manual", price: "1500.00", supplierPrice: "0" },
			"customer",
			MARGIN_RULES,
		);
		expect(price).toBe(1500);
	});

	it("computes provider products from supplierPrice + margins", () => {
		const price = resolveSalePrice(
			{ managedBy: "provider", price: "9999.00", supplierPrice: "1000" },
			"customer",
			MARGIN_RULES,
		);
		expect(price).toBe(1300); // 1000 * 1.30
	});

	it("returns zero for a manual product without a valid price", () => {
		const price = resolveSalePrice(
			{ managedBy: "manual", price: null, supplierPrice: "0" },
			"customer",
			MARGIN_RULES,
		);
		expect(price).toBe(0);
	});
});
