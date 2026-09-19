import { describe, expect, it } from "bun:test";
import { buildCategoryContext, buildExtractionPrompt } from "../prompts";

const rows = [
	{ id: "parent", name: "Componentes CPU", parentId: null },
	{ id: "ram", name: "Memorias RAM", parentId: "parent" },
	{ id: "camaras", name: "Cámaras", parentId: null },
];

describe("buildCategoryContext", () => {
	it("computes leaf flags and parent names from the category tree", () => {
		expect(buildCategoryContext(rows)).toEqual([
			{ name: "Componentes CPU", parent: null, leaf: false },
			{ name: "Memorias RAM", parent: "Componentes CPU", leaf: true },
			{ name: "Cámaras", parent: null, leaf: true },
		]);
	});

	it("tolerates an orphan parent id", () => {
		const context = buildCategoryContext([{ id: "x", name: "Suelta", parentId: "missing" }]);
		expect(context[0]).toEqual({ name: "Suelta", parent: null, leaf: true });
	});
});

describe("buildExtractionPrompt", () => {
	const prompt = buildExtractionPrompt("CASE GAMER MICRONICS FC101  5FAN ARGB", {
		categories: buildCategoryContext(rows),
		brands: ["Micronics"],
	});

	it("offers only leaf categories, with the hierarchy as context", () => {
		expect(prompt).toContain("Componentes CPU > Memorias RAM");
		expect(prompt).toContain("  - Cámaras");
		// The parent must never appear as an option on its own line.
		expect(prompt).not.toContain("  - Componentes CPU\n");
	});

	it("carries the rule that made v2 succeed: never drop technical tokens", () => {
		expect(prompt).toContain("CONSERVA TODOS los tokens técnicos");
		expect(prompt).not.toContain("Longitud moderada");
	});

	it("injects the attribute vocabulary and leaves no placeholder behind", () => {
		expect(prompt).toContain("Memorias RAM: Capacidad, Generación, Velocidad");
		expect(prompt).not.toContain("{{ATTRIBUTE_VOCABULARY}}");
	});

	it("includes the raw title and the canonical brand list", () => {
		expect(prompt).toContain("CASE GAMER MICRONICS FC101  5FAN ARGB");
		expect(prompt).toContain("Micronics");
	});

	it("handles an empty catalog gracefully", () => {
		const empty = buildExtractionPrompt("X", { categories: [], brands: [] });

		expect(empty).toContain("No hay categorías registradas");
		expect(empty).toContain("No hay marcas registradas");
	});
});
