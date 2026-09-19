import { describe, expect, it } from "bun:test";
import { buildProductSeo } from "../product-seo";

const monitor = {
	name: "Monitor Gamer Micronics Brickell DG27FC 27'' Curvo FHD 100Hz 1ms VA",
	brandName: "Micronics",
	categoryName: "Monitores",
	specifications: [
		{ id: "1", key: "Tamaño de Pantalla", value: "27 pulgadas" },
		{ id: "2", key: "Resolución", value: "FHD (1920x1080)" },
		{ id: "3", key: "Tasa de Refresco", value: "100Hz" },
		{ id: "4", key: "Tiempo de Respuesta", value: "1ms" },
		{ id: "5", key: "Tipo de Panel", value: "VA" },
	],
};

describe("buildProductSeo", () => {
	it("adds the site suffix to the title", () => {
		expect(buildProductSeo(monitor).seoTitle).toBe(`${monitor.name} | Renovabit`);
	});

	it("caps the title at the column length", () => {
		const seo = buildProductSeo({ ...monitor, name: "X".repeat(400) });

		expect(seo.seoTitle.length).toBeLessThanOrEqual(255);
		expect(seo.seoTitle.endsWith(" | Renovabit")).toBe(true);
	});

	it("builds the description from the name and the leading specs", () => {
		const seo = buildProductSeo(monitor);

		expect(seo.seoDescription).toContain(monitor.name);
		expect(seo.seoDescription).toContain("Tasa de Refresco: 100Hz");
		expect(seo.seoDescription.length).toBeLessThanOrEqual(500);
	});

	it("stops adding specs once the meta target is reached", () => {
		const longSpecs = Array.from({ length: 6 }, (_, i) => ({
			id: String(i),
			key: "Especificación larga",
			value: "un valor bastante largo para medir",
		}));
		const seo = buildProductSeo({ ...monitor, name: "Corto", specifications: longSpecs });

		// Two specs fit under the ~160 char target; the rest are dropped.
		expect(seo.seoDescription.length).toBeLessThanOrEqual(200);
		expect(seo.seoDescription.match(/Especificación larga/g)?.length).toBeLessThan(6);
	});

	it("returns just the name when there are no specifications", () => {
		expect(buildProductSeo({ ...monitor, specifications: [] }).seoDescription).toBe(
			`${monitor.name}.`,
		);
	});

	it("tolerates null specifications and null brand/category", () => {
		const seo = buildProductSeo({
			name: "Cable HDMI 8K",
			brandName: null,
			categoryName: null,
			specifications: null,
		});

		expect(seo.seoKeywords).toBe("");
		expect(seo.seoDescription).toBe("Cable HDMI 8K.");
	});

	it("dedupes keywords and skips prose-length values", () => {
		const seo = buildProductSeo({
			...monitor,
			specifications: [
				{ id: "1", key: "Marca", value: "Micronics" },
				{ id: "2", key: "Nota", value: "Un texto que claramente supera los treinta caracteres" },
				{ id: "3", key: "Panel", value: "VA" },
			],
		});

		const terms = seo.seoKeywords.split(", ");
		expect(terms.filter((term) => term === "Micronics")).toHaveLength(1);
		expect(terms).toContain("Monitores");
		expect(terms).toContain("VA");
		expect(seo.seoKeywords).not.toContain("supera los treinta");
	});

	it("caps the keywords at the column length", () => {
		const specifications = Array.from({ length: 60 }, (_, i) => ({
			id: String(i),
			key: "Clave",
			value: `valor-${i}`,
		}));
		const seo = buildProductSeo({ ...monitor, specifications });

		expect(seo.seoKeywords.length).toBeLessThanOrEqual(500);
	});
});
