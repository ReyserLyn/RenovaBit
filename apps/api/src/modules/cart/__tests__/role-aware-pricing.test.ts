import { describe, expect, it } from "bun:test";
import { getEffectiveSalePrice } from "@renovabit/pricing";

// ── Test data ──────────────────────────────────────────────
//
// Product: Intel Ultra 7 265F
//   supplierPrice: "1440"  (the raw cost / admin price)
//   roleCustomMargins: {
//     customer: { enabled: true, percent: "50" },   ← 50% margin → 1440 * 1.5 = 2160
//   }

const PRODUCT = {
	supplierPrice: "1440",
	roleCustomMargins: {
		customer: { enabled: true as const, percent: "50" },
	},
};

// Tier rules with the customer percentage.
// Range [0, 100000) → customer 30%.
const MARGIN_RULES: ReadonlyArray<{
	minPrice: string;
	maxPrice: string | null;
	customerPct: string;
}> = [{ minPrice: "0", maxPrice: "100000", customerPct: "30" }];

describe("Cart role-aware pricing (via getEffectiveSalePrice)", () => {
	it("guest (customer role) sees 2160 — customer per-product override 50%", () => {
		const { salePrice } = getEffectiveSalePrice(PRODUCT, "customer", MARGIN_RULES);
		expect(salePrice).toBe(2160);
	});

	it("customer sees 2160 — customer per-product override 50%", () => {
		const { salePrice } = getEffectiveSalePrice(PRODUCT, "customer", MARGIN_RULES);
		expect(salePrice).toBe(2160);
	});

	it("admin sees 1440 — raw supplier price (no margin)", () => {
		const { salePrice } = getEffectiveSalePrice(PRODUCT, "admin", MARGIN_RULES);
		expect(salePrice).toBe(1440);
	});

	it("price changed detection: different roles produce different prices", () => {
		const customerPrice = getEffectiveSalePrice(PRODUCT, "customer", MARGIN_RULES);
		const adminPrice = getEffectiveSalePrice(PRODUCT, "admin", MARGIN_RULES);

		expect(customerPrice.salePrice).not.toBe(adminPrice.salePrice);
	});

	it("customer with no per-product override uses customerPct from the tier", () => {
		const plainProduct = { supplierPrice: "1000", roleCustomMargins: null };
		const { salePrice } = getEffectiveSalePrice(plainProduct, "customer", MARGIN_RULES);
		// 30% customer margin → 1000 * 1.3 = 1300
		expect(salePrice).toBe(1300);
	});

	it("subtotal matches roleAwarePrice * quantity", () => {
		// Simulates getCartWithItems / getTotal behavior
		const roleAwarePrice = getEffectiveSalePrice(PRODUCT, "customer", MARGIN_RULES).salePrice;
		const quantity = 3;
		const subtotal = roleAwarePrice * quantity;
		expect(subtotal).toBe(6480); // 2160 * 3
	});

	it("addedAtPrice format matches toFixed(2) pattern", () => {
		const { salePrice } = getEffectiveSalePrice(PRODUCT, "customer", MARGIN_RULES);
		const addedAtPrice = salePrice.toFixed(2);
		expect(addedAtPrice).toBe("2160.00");
	});

	describe("no-supplier-price edge case", () => {
		it("returns 0 salePrice when supplierPrice is invalid", () => {
			const { salePrice } = getEffectiveSalePrice(
				{ supplierPrice: "0", roleCustomMargins: null },
				"customer",
				MARGIN_RULES,
			);
			expect(salePrice).toBe(0);
		});

		it("returns 0 salePrice when supplierPrice is empty", () => {
			const { salePrice } = getEffectiveSalePrice(
				{ supplierPrice: "", roleCustomMargins: null },
				"customer",
				MARGIN_RULES,
			);
			expect(salePrice).toBe(0);
		});
	});
});
