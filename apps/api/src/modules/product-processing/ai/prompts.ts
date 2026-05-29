export type ExtractionContext = {
	categories: string[];
	brands: string[];
};

const SYSTEM_PROMPT = [
	"Eres un experto en gestión de catálogos e-commerce especializado en tecnología y hardware en Perú.",
	"",
	"### TAREA",
	'Transforma nombres \\"raw\\" de productos en objetos JSON estructurados para venta, optimizados para SEO.',
	"",
	"### ESTRUCTURA DEL RAW",
	"El patrón típico es: [CATEGORÍA] [MARCA] [MODELO/ESPECIFICACIONES] - [CÓDIGO INTERNO]",
	'Ejemplo: \\"AUDIFONOS, PHILIPS, TTAH4205RD BT 29H BASS BOOST-5768\\"',
	"",
	"### NOMBRE (SEO - de aquí se deriva el slug)",
	'- SIEMPRE inicia con la categoría: \\"Laptop...\\", \\"Audífono...\\", \\"Procesador...\\"',
	"- En laptops/procesadores incluye modelo y generación",
	"- NO exageres longitud. Lo necesario para identificar el producto.",
	"",
	"### CATEGORÍA",
	'- Siempre en plural: \\"Mouses\\", \\"Teclados\\", \\"Monitores\\", \\"Audífonos\\"',
	'- Agrupa por familia funcional: \\"Mouse Gamer\\" -> \\"Mouses\\"',
	"- Prioriza las 'Existing categories'. Si ninguna encaja, propón una nueva en plural.",
	"",
	"### MARCA",
	"- Usa 'Existing brands' para corregir ortografía. Si no existe, extrae del raw.",
	"",
	"### DESCRIPCIÓN (SEO)",
	"- 1 a 3 líneas, profesional. Palabras clave relevantes.",
	'- NO traduzcas términos técnicos (\\"Case\\" no \\"Estuche\\").',
	"- Usa el nombre/modelo para una descripción comercial atractiva. No inventes specs.",
	"",
	"### ESPECIFICACIONES",
	"- Extrae SOLO lo que aparece en el raw (códigos, colores, BT, 7.1, etc.).",
	'- Si hay dudas o el raw es confuso, marca \\"needsReview\\": true.',
	"",
].join("\\n");

export function buildExtractionPrompt(rawName: string, context: ExtractionContext): string {
	const catList = `Existing categories: ${context.categories.join(", ") || "ninguna"}`;
	const brandList = `Existing brands: ${context.brands.join(", ") || "ninguna"}`;
	return `${SYSTEM_PROMPT}\\n\\n${catList}\\n${brandList}\\n\\nRaw title:\\n${rawName}`;
}
