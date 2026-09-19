import { describe, expect, it } from "bun:test";
import { RAW_NAME_MAX, sanitizeRawName } from "../sanitize";
import { productExtractionSchema } from "../schemas";

describe("sanitizeRawName", () => {
	it("keeps a normal supplier title intact", () => {
		const raw = "MEMORIA RAM,  ADATA, SODIM DDR5 32GB 5600MHZ";
		expect(sanitizeRawName(raw)).toBe("MEMORIA RAM, ADATA, SODIM DDR5 32GB 5600MHZ");
	});

	it("collapses newlines and repeated whitespace", () => {
		expect(sanitizeRawName("AUDIFONO\n\tGAMER   RAZER")).toBe("AUDIFONO GAMER RAZER");
	});

	it("strips control characters that could smuggle instructions", () => {
		expect(sanitizeRawName("MOUSE\u0000\u001b[31m GAMER\u0085")).toBe("MOUSE [31m GAMER");
	});

	it("caps the length at RAW_NAME_MAX", () => {
		expect(sanitizeRawName("X".repeat(RAW_NAME_MAX + 500))).toHaveLength(RAW_NAME_MAX);
	});

	it("trims surrounding whitespace", () => {
		expect(sanitizeRawName("   CASE GAMER   ")).toBe("CASE GAMER");
	});
});

describe("productExtractionSchema", () => {
	const valid = {
		name: "Memoria RAM ADATA DDR5 32GB 5600MHz",
		brand: "ADATA",
		category: "Memorias RAM",
		description: "Memoria RAM DDR5 de 32GB a 5600MHz.",
		specifications: [{ id: "1", key: "Capacidad", value: "32GB" }],
		needsReview: false,
	};

	it("accepts a well-formed extraction", () => {
		expect(productExtractionSchema.safeParse(valid).success).toBe(true);
	});

	it("accepts empty brand and category (the sync marks those for review)", () => {
		expect(productExtractionSchema.safeParse({ ...valid, brand: "", category: "" }).success).toBe(
			true,
		);
	});

	it("rejects an HTML break-out in the name", () => {
		const result = productExtractionSchema.safeParse({
			...valid,
			name: 'Mouse </script><script>alert("x")</script>',
		});
		expect(result.success).toBe(false);
	});

	it("rejects an HTML break-out in a specification value", () => {
		const result = productExtractionSchema.safeParse({
			...valid,
			specifications: [{ id: "1", key: "Color", value: "<img src=x onerror=alert(1)>" }],
		});
		expect(result.success).toBe(false);
	});

	it("rejects a name that would overflow the products.name column", () => {
		expect(productExtractionSchema.safeParse({ ...valid, name: "a".repeat(201) }).success).toBe(
			false,
		);
	});

	it("rejects more specifications than the product allows", () => {
		const specifications = Array.from({ length: 51 }, (_, i) => ({
			id: String(i),
			key: "Color",
			value: "Negro",
		}));
		expect(productExtractionSchema.safeParse({ ...valid, specifications }).success).toBe(false);
	});
});
