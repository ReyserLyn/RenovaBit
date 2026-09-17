/**
 * Unit tests for calculate-effective-price.ts — role-aware pricing.
 *
 * One row covers both non-admin roles: the function picks the column
 * matching the user's role from whichever rule matches the price.
 */
import { describe, expect, it } from "bun:test";
import { getEffectiveSalePrice, validateSupplierPrice } from "../calculate-effective-price";

// One row per price tier, with both customer and distributor percentages.
const rules = [
	{ minPrice: "0", maxPrice: "100", customerPct: "25", distributorPct: "22" },
	{ minPrice: "100", maxPrice: "800", customerPct: "15", distributorPct: "12" },
	{ minPrice: "800", maxPrice: null, customerPct: "10", distributorPct: "7" },
];

describe("getEffectiveSalePrice — admin role", () => {
	it("returns raw supplier price, 0% margin for admin", () => {
		const r = getEffectiveSalePrice({ supplierPrice: "100" }, "admin", rules);
		expect(r).toEqual({ salePrice: 100, marginPercent: 0, source: "admin-raw" });
	});

	it("admin ignores per-product override", () => {
		const r = getEffectiveSalePrice(
			{ supplierPrice: "100", roleCustomMargins: { customer: { enabled: true, percent: "40" } } },
			"admin",
			rules,
		);
		expect(r.salePrice).toBe(100);
		expect(r.marginPercent).toBe(0);
	});
});

describe("getEffectiveSalePrice — customer role", () => {
	it("uses customer tier when no override", () => {
		const r = getEffectiveSalePrice({ supplierPrice: "150" }, "customer", rules);
		// 150 → tier [100, 800) → customerPct 15% → 172.5
		expect(r).toEqual({ salePrice: 172.5, marginPercent: 15, source: "tier" });
	});

	it("uses per-product override when enabled for customer", () => {
		const r = getEffectiveSalePrice(
			{
				supplierPrice: "50",
				roleCustomMargins: { customer: { enabled: true, percent: "40" } },
			},
			"customer",
			rules,
		);
		expect(r).toEqual({ salePrice: 70, marginPercent: 40, source: "per-product-override" });
	});

	it("returns salePrice=0 and marginPercent=0 when supplierPrice is 0", () => {
		const r = getEffectiveSalePrice({ supplierPrice: "0" }, "customer", rules);
		expect(r).toEqual({ salePrice: 0, marginPercent: 0, source: "no-supplier-price" });
	});
});

describe("getEffectiveSalePrice — distributor role", () => {
	it("uses distributorPct column of the matching tier", () => {
		const r = getEffectiveSalePrice({ supplierPrice: "150" }, "distributor", rules);
		// 150 → tier [100, 800) → distributorPct 12% → 168
		expect(r).toEqual({ salePrice: 168, marginPercent: 12, source: "tier" });
	});

	it("uses per-product override when enabled for distributor", () => {
		const r = getEffectiveSalePrice(
			{
				supplierPrice: "150",
				roleCustomMargins: { distributor: { enabled: true, percent: "7" } },
			},
			"distributor",
			rules,
		);
		// override wins → 150 × 1.07 = 160.5
		expect(r).toEqual({
			salePrice: 160.5,
			marginPercent: 7,
			source: "per-product-override",
		});
	});

	it("customer override does NOT apply to distributor", () => {
		const r = getEffectiveSalePrice(
			{
				supplierPrice: "150",
				roleCustomMargins: { customer: { enabled: true, percent: "40" } },
			},
			"distributor",
			rules,
		);
		// customer override is set, but role is distributor → distributorPct 12% wins
		expect(r).toEqual({ salePrice: 168, marginPercent: 12, source: "tier" });
	});
});

describe("getEffectiveSalePrice — edge cases", () => {
	it("returns DEFAULT (20%) when no rules match and no override", () => {
		const r = getEffectiveSalePrice({ supplierPrice: "500" }, "customer", []);
		expect(r.marginPercent).toBe(20);
		expect(r.salePrice).toBe(600);
		expect(r.source).toBe("default-fallback");
	});

	it("distributor fallback uses DEFAULT_DISTRIBUTOR_MARGIN_PERCENT (10%) when no rules match", () => {
		const r = getEffectiveSalePrice({ supplierPrice: "500" }, "distributor", []);
		expect(r.marginPercent).toBe(10);
		expect(r.salePrice).toBe(550);
		expect(r.source).toBe("default-fallback");
	});

	it("distributor fallback when no rule matches price range (10%)", () => {
		const r = getEffectiveSalePrice({ supplierPrice: "99999" }, "distributor", [
			{ minPrice: "0", maxPrice: "100", customerPct: "25", distributorPct: "22" },
		]);
		// 99999 is outside [0, 100), so fallback → 10% → 109998.9
		expect(r.marginPercent).toBe(10);
		expect(r.source).toBe("default-fallback");
	});

	it("clamps invalid override percent to tier", () => {
		const r = getEffectiveSalePrice(
			{
				supplierPrice: "150",
				roleCustomMargins: { customer: { enabled: true, percent: "99999" } }, // > 1000
			},
			"customer",
			rules,
		);
		// invalid override → fall through to tier
		expect(r.source).toBe("tier");
	});

	it("supplierPrice = '-50' → no-supplier-price", () => {
		const r = getEffectiveSalePrice({ supplierPrice: "-50" }, "customer", rules);
		expect(r.salePrice).toBe(0);
		expect(r.marginPercent).toBe(0);
		expect(r.source).toBe("no-supplier-price");
	});

	it("supplierPrice = 'abc' → no-supplier-price", () => {
		const r = getEffectiveSalePrice({ supplierPrice: "abc" }, "customer", rules);
		expect(r.salePrice).toBe(0);
		expect(r.marginPercent).toBe(0);
		expect(r.source).toBe("no-supplier-price");
	});

	it("supplierPrice = '' → no-supplier-price", () => {
		const r = getEffectiveSalePrice({ supplierPrice: "" }, "customer", rules);
		expect(r.salePrice).toBe(0);
		expect(r.marginPercent).toBe(0);
		expect(r.source).toBe("no-supplier-price");
	});

	it("custom margin at MAX_CUSTOM_MARGIN_PERCENT boundary (1000) is accepted", () => {
		const r = getEffectiveSalePrice(
			{
				supplierPrice: "50",
				roleCustomMargins: { customer: { enabled: true, percent: "1000" } },
			},
			"customer",
			rules,
		);
		// 50 * (1 + 1000/100) = 50 * 11 = 550
		expect(r.salePrice).toBe(550);
		expect(r.marginPercent).toBe(1000);
		expect(r.source).toBe("per-product-override");
	});

	it("negative custom percent falls back to tier", () => {
		const r = getEffectiveSalePrice(
			{
				supplierPrice: "150",
				roleCustomMargins: { customer: { enabled: true, percent: "-5" } },
			},
			"customer",
			rules,
		);
		// negative → invalid → fallback to tier [100, 800) → customerPct 15%
		expect(r.marginPercent).toBe(15);
		expect(r.source).toBe("tier");
	});

	it("non-numeric custom percent falls back to tier", () => {
		const r = getEffectiveSalePrice(
			{
				supplierPrice: "150",
				roleCustomMargins: { customer: { enabled: true, percent: "abc" } },
			},
			"customer",
			rules,
		);
		expect(r.marginPercent).toBe(15);
		expect(r.source).toBe("tier");
	});

	it("empty roleCustomMargins object — no override applied", () => {
		const r = getEffectiveSalePrice(
			{ supplierPrice: "150", roleCustomMargins: {} },
			"customer",
			rules,
		);
		expect(r.marginPercent).toBe(15);
		expect(r.source).toBe("tier");
	});

	it("no rules, no override → default-fallback for customer", () => {
		const r = getEffectiveSalePrice({ supplierPrice: "500" }, "customer", []);
		expect(r.marginPercent).toBe(20);
		expect(r.source).toBe("default-fallback");
	});

	it("no rules, no override → default-fallback for distributor (10%)", () => {
		const r = getEffectiveSalePrice({ supplierPrice: "500" }, "distributor", []);
		expect(r.marginPercent).toBe(10);
		expect(r.salePrice).toBe(550);
		expect(r.source).toBe("default-fallback");
	});

	it("distributor with single rule that doesn't match → 10% fallback", () => {
		const r = getEffectiveSalePrice({ supplierPrice: "500" }, "distributor", [
			{ minPrice: "0", maxPrice: "100", customerPct: "25", distributorPct: "22" },
		]);
		// No rule matches (500 > 100) → distributor fallback 10%
		expect(r.marginPercent).toBe(10);
		expect(r.salePrice).toBe(550);
		expect(r.source).toBe("default-fallback");
	});

	it("same row returns different pcts for customer vs distributor (column pick)", () => {
		// Single row at [0, 100) with customerPct=30 and distributorPct=20.
		// Both roles fall in the same range; only the column differs.
		const single = [{ minPrice: "0", maxPrice: "100", customerPct: "30", distributorPct: "20" }];
		const customer = getEffectiveSalePrice({ supplierPrice: "50" }, "customer", single);
		const distributor = getEffectiveSalePrice({ supplierPrice: "50" }, "distributor", single);
		// 50 * 1.30 = 65 (customer)
		expect(customer).toEqual({ salePrice: 65, marginPercent: 30, source: "tier" });
		// 50 * 1.20 = 60 (distributor)
		expect(distributor).toEqual({ salePrice: 60, marginPercent: 20, source: "tier" });
	});

	it("multiple rules — first matching tier wins (no fallthrough)", () => {
		// Two adjacent tiers; supplier at exactly the boundary 100 goes to the second
		// tier (range is [min, max) — max exclusive).
		const tiers = [
			{ minPrice: "0", maxPrice: "100", customerPct: "25", distributorPct: "20" },
			{ minPrice: "100", maxPrice: null, customerPct: "15", distributorPct: "12" },
		];
		// 50 → first tier → 25%
		const at50 = getEffectiveSalePrice({ supplierPrice: "50" }, "customer", tiers);
		expect(at50).toEqual({ salePrice: 62.5, marginPercent: 25, source: "tier" });
		// 100 → second tier (exclusive) → 15%
		const at100 = getEffectiveSalePrice({ supplierPrice: "100" }, "customer", tiers);
		expect(at100).toEqual({ salePrice: 115, marginPercent: 15, source: "tier" });
	});

	it("invalid customer override (>1000) with a matching tier falls back to tier (not default)", () => {
		// Bug-check: an override out of range should NOT skip the tier. The
		// function validates the override, finds it invalid, then continues
		// to the tier lookup which still matches.
		const r = getEffectiveSalePrice(
			{
				supplierPrice: "150",
				roleCustomMargins: { customer: { enabled: true, percent: "5000" } },
			},
			"customer",
			rules, // [100, 800) → 15% customer
		);
		expect(r).toEqual({ salePrice: 172.5, marginPercent: 15, source: "tier" });
	});
});

describe("validateSupplierPrice", () => {
	it("returns null for empty string", () => {
		expect(validateSupplierPrice("")).toBeNull();
	});

	it("returns null for '0'", () => {
		expect(validateSupplierPrice("0")).toBeNull();
	});

	it("returns null for negative string", () => {
		expect(validateSupplierPrice("-50")).toBeNull();
	});

	it("returns null for non-numeric string", () => {
		expect(validateSupplierPrice("abc")).toBeNull();
	});

	it("returns { price } for valid positive string", () => {
		expect(validateSupplierPrice("50")).toEqual({ price: 50 });
	});

	it("returns { price } for decimal string", () => {
		expect(validateSupplierPrice("99.99")).toEqual({ price: 99.99 });
	});
});
