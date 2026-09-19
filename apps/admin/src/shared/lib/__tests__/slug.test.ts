import { describe, expect, it } from "bun:test";
import { generateSlug } from "../slug";

describe("generateSlug", () => {
	it("lowercases and hyphenates words", () => {
		expect(generateSlug("ASUS ROG")).toBe("asus-rog");
		expect(generateSlug("Samsung 4K OLED")).toBe("samsung-4k-oled");
	});

	it("collapses repeated and surrounding whitespace", () => {
		expect(generateSlug("  Logitech  G ")).toBe("logitech-g");
		expect(generateSlug("   ")).toBe("");
	});

	it("transliterates accented characters", () => {
		expect(generateSlug("Cámara Ñandú Café")).toBe("camara-nandu-cafe");
		expect(generateSlug("¿Qué? ¡Sí!")).toBe("que-si");
	});

	it("drops characters with no ASCII equivalent", () => {
		expect(generateSlug("Ünïcödé 日本")).toBe("unicode");
		expect(generateSlug("😀 emoji")).toBe("emoji");
	});

	it("removes underscores instead of turning them into hyphens", () => {
		expect(generateSlug("a--b__c")).toBe("a-bc");
	});

	it("renders the percent sign as a word", () => {
		expect(generateSlug("Café ☕ 100%")).toBe("cafe-100percent");
	});
});
