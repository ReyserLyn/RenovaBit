import { describe, expect, it } from "bun:test";
import {
	bulkDeleteSchema,
	createProductSchema,
	PRODUCT_SPECS_MAX,
	productFormSchema,
	toRoleCustomMargins,
} from "../model";

const validForm = {
	name: "  Mechanical Keyboard  ",
	slug: "mechanical-keyboard",
	description: "",
	sku: "KB-001",
	price: "99.99",
	supplierPrice: "",
	managedBy: "provider" as const,
	customerEnabled: false,
	customerPercent: "",
	stock: 5,
	specifications: [],
	isActive: true,
	isFeatured: false,
	seoTitle: "",
	seoDescription: "",
	seoKeywords: "",
};

describe("productFormSchema", () => {
	it("accepts a complete form and trims text fields", () => {
		const parsed = productFormSchema.parse(validForm);

		expect(parsed.name).toBe("Mechanical Keyboard");
		expect(parsed.slug).toBe("mechanical-keyboard");
	});

	it("requires a non-empty name and SKU", () => {
		expect(productFormSchema.safeParse({ ...validForm, name: "   " }).success).toBe(false);
		expect(productFormSchema.safeParse({ ...validForm, sku: "" }).success).toBe(false);
	});

	it("accepts prices up to two decimals and an empty supplier cost", () => {
		expect(productFormSchema.safeParse({ ...validForm, price: "12" }).success).toBe(true);
		expect(productFormSchema.safeParse({ ...validForm, price: "12.3" }).success).toBe(true);
		expect(productFormSchema.safeParse({ ...validForm, price: "12.34" }).success).toBe(true);
		expect(productFormSchema.safeParse({ ...validForm, supplierPrice: "" }).success).toBe(true);
	});

	it("rejects malformed prices", () => {
		expect(productFormSchema.safeParse({ ...validForm, price: "" }).success).toBe(false);
		expect(productFormSchema.safeParse({ ...validForm, price: "12.345" }).success).toBe(false);
		expect(productFormSchema.safeParse({ ...validForm, price: "-12" }).success).toBe(false);
		expect(productFormSchema.safeParse({ ...validForm, price: "abc" }).success).toBe(false);
		expect(productFormSchema.safeParse({ ...validForm, supplierPrice: "12.345" }).success).toBe(
			false,
		);
	});

	it("validates the customer margin against MAX_CUSTOM_MARGIN_PERCENT", () => {
		expect(productFormSchema.safeParse({ ...validForm, customerPercent: "0" }).success).toBe(true);
		expect(productFormSchema.safeParse({ ...validForm, customerPercent: "1000" }).success).toBe(
			true,
		);
		expect(productFormSchema.safeParse({ ...validForm, customerPercent: "1000.01" }).success).toBe(
			false,
		);
		expect(productFormSchema.safeParse({ ...validForm, customerPercent: "-1" }).success).toBe(
			false,
		);
		expect(productFormSchema.safeParse({ ...validForm, customerPercent: "abc" }).success).toBe(
			false,
		);
	});

	it("rejects a negative or fractional stock", () => {
		expect(productFormSchema.safeParse({ ...validForm, stock: -1 }).success).toBe(false);
		expect(productFormSchema.safeParse({ ...validForm, stock: 1.5 }).success).toBe(false);
	});

	it(`caps specifications at ${PRODUCT_SPECS_MAX}`, () => {
		const specifications = Array.from({ length: PRODUCT_SPECS_MAX + 1 }, (_, index) => ({
			id: String(index),
			key: "key",
			value: "value",
		}));

		expect(productFormSchema.safeParse({ ...validForm, specifications }).success).toBe(false);
	});
});

describe("createProductSchema", () => {
	it("requires only name and SKU", () => {
		expect(createProductSchema.safeParse({ name: "Keyboard", sku: "KB-001" }).success).toBe(true);
	});
});

describe("bulkDeleteSchema", () => {
	it("requires between 1 and 50 ids", () => {
		expect(bulkDeleteSchema.safeParse({ ids: [] }).success).toBe(false);
		expect(bulkDeleteSchema.safeParse({ ids: ["product-1"] }).success).toBe(true);
		expect(bulkDeleteSchema.safeParse({ ids: Array.from({ length: 50 }, String) }).success).toBe(
			true,
		);
		expect(bulkDeleteSchema.safeParse({ ids: Array.from({ length: 51 }, String) }).success).toBe(
			false,
		);
	});
});

describe("toRoleCustomMargins", () => {
	it("builds a customer margin when enabled with a value", () => {
		expect(toRoleCustomMargins({ customerEnabled: true, customerPercent: "25" })).toEqual({
			customer: { enabled: true, percent: "25" },
		});
	});

	it("returns null when disabled or when the percentage is empty", () => {
		expect(toRoleCustomMargins({ customerEnabled: false, customerPercent: "25" })).toBeNull();
		expect(toRoleCustomMargins({ customerEnabled: true, customerPercent: "" })).toBeNull();
	});
});
