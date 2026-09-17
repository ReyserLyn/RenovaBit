/**
 * Search endpoint tests.
 *
 * F13: offset > 10000 must return 400 (INPUT_VALIDATION_ERROR).
 * F6: search results include offers per product.
 */
import { describe, expect, it } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { ProductModel } from "../model";

// ═══════════════════════════════════════════════════════
//  F13 — Offset cap
// ═══════════════════════════════════════════════════════

describe("search query offset cap (F13)", () => {
	it("accepts offset = 10000", () => {
		const ok = Value.Check(ProductModel.searchQuery, { q: "test", offset: 10000 });
		expect(ok).toBe(true);
	});

	it("rejects offset > 10000", () => {
		const ok = Value.Check(ProductModel.searchQuery, { q: "test", offset: 999999999 });
		expect(ok).toBe(false);
	});

	it("rejects negative offset", () => {
		const ok = Value.Check(ProductModel.searchQuery, { q: "test", offset: -1 });
		expect(ok).toBe(false);
	});

	it("accepts offset = 0", () => {
		const ok = Value.Check(ProductModel.searchQuery, { q: "test", offset: 0 });
		expect(ok).toBe(true);
	});
});

describe("search limit cap (F13)", () => {
	it("accepts limit = 100", () => {
		const ok = Value.Check(ProductModel.searchQuery, { q: "test", limit: 100 });
		expect(ok).toBe(true);
	});

	it("rejects limit > 100", () => {
		const ok = Value.Check(ProductModel.searchQuery, { q: "test", limit: 101 });
		expect(ok).toBe(false);
	});

	it("rejects limit = 0", () => {
		const ok = Value.Check(ProductModel.searchQuery, { q: "test", limit: 0 });
		expect(ok).toBe(false);
	});

	it("accepts default limit = 20 when omitted", () => {
		const ok = Value.Check(ProductModel.searchQuery, { q: "test" });
		expect(ok).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════
//  F6 — Offers in search response
// ═══════════════════════════════════════════════════════

describe("search response includes offers (F6)", () => {
	it("ProductSearchResult accepts empty offers array", () => {
		const dataItem = {
			id: "00000000-0000-0000-0000-000000000001",
			name: "Test Product",
			slug: "test-product",
			sku: "TEST-001",
			price: "100.00",
			offerPrice: null,
			discountPercent: null,
			isInStock: true,
			isFeatured: false,
			stock: 10,
			primaryImage: null,
			brand: null,
			category: null,
			headline: null,
			offers: [],
		};
		const ok = Value.Check(ProductModel.searchResponse, {
			data: [dataItem],
			total: 1,
			limit: 20,
			offset: 0,
			hasMore: false,
		});
		expect(ok).toBe(true);
	});

	it("accepts offers with full offer ref data", () => {
		const dataItem = {
			id: "00000000-0000-0000-0000-000000000001",
			name: "Test Product",
			slug: "test-product",
			sku: "TEST-001",
			price: "100.00",
			offerPrice: "90.00",
			discountPercent: 10,
			isInStock: true,
			isFeatured: false,
			stock: 10,
			primaryImage: null,
			brand: null,
			category: null,
			headline: null,
			offers: [
				{
					id: "00000000-0000-0000-0000-000000000099",
					name: "10% OFF",
					slug: "10-off",
					discountValue: "10.00",
					isFeatured: false,
					endsAt: new Date("2026-12-31T23:59:59Z"),
				},
			],
		};
		const ok = Value.Check(ProductModel.searchResponse, {
			data: [dataItem],
			total: 1,
			limit: 20,
			offset: 0,
			hasMore: false,
		});
		expect(ok).toBe(true);
	});
});
