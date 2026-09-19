/**
 * Scored comparison of extraction outputs against the raw supplier title.
 *
 * The core question this answers: does the generated product name keep every
 * technical token the supplier gave us? A name that drops "5FAN ARGB" or "1ms"
 * is a lost sale for a buyer filtering by that spec, so the metric that matters
 * is per-token recall, not a subjective reading.
 */

export interface SpecToken {
	text: string;
	kind: string;
}

const TOKEN_PATTERNS: Array<{ kind: string; re: RegExp }> = [
	{ kind: "capacidad", re: /\d+(?:[.,]\d+)?\s?(?:GB|TB|MB)\b/gi },
	{ kind: "frecuencia", re: /\d+(?:[.,]\d+)?\s?(?:MHZ|GHZ|HZ)\b/gi },
	{ kind: "resolucion", re: /\b\d{3,4}P\b|\bFHD\b|\bQHD\b|\bUHD\b|\b4K\b|\b2K\b/gi },
	{ kind: "respuesta", re: /\d+(?:[.,]\d+)?\s?MS\b/gi },
	{ kind: "memoria", re: /\bDDR\s?\d\b|\bSODIMM\b|\bDIMM\b/gi },
	{ kind: "bus", re: /\bSATA\b|\bNVME\b|\bM\.?2\b|\bPCIE?\s?\d(?:\.\d)?\b/gi },
	{ kind: "nucleos", re: /\d+\s?(?:NUCLEOS?|HILOS?|CORES?|THREADS?)\b/gi },
	{ kind: "potencia", re: /\d+(?:[.,]\d+)?\s?W\b/gi },
	{ kind: "pulgadas", re: /\d+(?:[.,]\d+)?\s?(?:PULGADAS?|INCH|''|["“”]|\bP\b)/gi },
	{ kind: "rpm", re: /\d+\s?RPM\b/gi },
	{ kind: "dpi", re: /\d+\s?DPI\b/gi },
	{ kind: "ventiladores", re: /\d+\s?(?:FAN|VENTILADORES?)\b/gi },
	{ kind: "iluminacion", re: /\bARGB\b|\bRGB\b/gi },
	{ kind: "panel", re: /\bIPS\b|\bVA\b|\bTN\b|\bOLED\b/gi },
	{
		kind: "conectividad",
		re: /\bWI-?FI\s?\d?\b|\bBT\b|\bBLUETOOTH\b|\bUSB[\s-]?C?\b|\bHDMI\s?\d(?:\.\d)?\b|\bDISPLAYPORT\b/gi,
	},
	{
		kind: "tono",
		re: /\bNEGRO\b|\bBLANCO\b|\bAZUL\b|\bROJO\b|\bVERDE\b|\bAMARILLO\b|\bGRIS\b|\bROSA\b|\bMORADO\b|\bPLATA\b|\bDORADO\b|\bBLACK\b|\bWHITE\b|\bBLUE\b|\bRED\b|\bGREEN\b|\bGRAY\b|\bGREY\b|\bPINK\b|\bPURPLE\b|\bSILVER\b|\bGOLD\b|\bRAINBOW\b/gi,
	},
	{ kind: "modelo", re: /\b[A-Z]{1,5}\d{2,}[A-Z0-9-]*\b/g },
];

/** Lowercase, unify inch notations and drop punctuation so tokens compare. */
export function normalizeForCompare(value: string): string {
	return value
		.toLowerCase()
		.replace(/["“”]|''/g, "pulg")
		.replace(/(\d+)\s*p\b/g, "$1pulg")
		.replace(/[^a-z0-9]/g, "");
}

export function extractSpecTokens(raw: string): SpecToken[] {
	const tokens: SpecToken[] = [];
	const seen = new Set<string>();

	for (const { kind, re } of TOKEN_PATTERNS) {
		for (const match of raw.matchAll(re)) {
			const text = match[0].trim();
			const normalized = normalizeForCompare(text);
			if (normalized.length === 0) continue;
			const key = `${kind}:${normalized}`;
			if (seen.has(key)) continue;
			seen.add(key);
			tokens.push({ text, kind });
		}
	}

	return tokens;
}

function levenshtein(a: string, b: string): number {
	const rows = a.length + 1;
	const cols = b.length + 1;
	let previous = Array.from({ length: cols }, (_, i) => i);

	for (let i = 1; i < rows; i++) {
		const current = [i];
		for (let j = 1; j < cols; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			current[j] = Math.min(
				(current[j - 1] ?? 0) + 1,
				(previous[j] ?? 0) + 1,
				(previous[j - 1] ?? 0) + cost,
			);
		}
		previous = current;
	}

	return previous[cols - 1] ?? 0;
}

/**
 * Word-level fuzzy match: the model may fix a supplier typo
 * ("SUPERCRDIOIDE" → "Supercardioide"), which should not read as a lost token.
 */
function containsFuzzy(normalizedText: string, normalizedToken: string): boolean {
	if (normalizedText.includes(normalizedToken)) return true;
	if (normalizedToken.length < 6 || /\d/.test(normalizedToken)) return false;

	const words = normalizedText.split(/[^a-z0-9]+/).filter(Boolean);
	return words.some(
		(word) =>
			Math.abs(word.length - normalizedToken.length) <= 2 &&
			levenshtein(word, normalizedToken) <= 2,
	);
}

/**
 * Colors are legitimately translated for a Spanish storefront: a raw "WHITE"
 * delivered as "Blanco" is an improvement, not a lost token. Any alias counts.
 */
const COLOR_ALIASES: Record<string, string[]> = {
	white: ["blanco", "white"],
	black: ["negro", "black"],
	blue: ["azul", "blue"],
	red: ["rojo", "red"],
	green: ["verde", "green"],
	yellow: ["amarillo", "yellow"],
	gray: ["gris", "gray", "grey"],
	grey: ["gris", "gray", "grey"],
	pink: ["rosa", "pink"],
	purple: ["morado", "purpura", "purple"],
	silver: ["plata", "plateado", "silver"],
	gold: ["dorado", "gold"],
	rainbow: ["rainbow"],
};

function hasColorAlias(normalizedText: string, normalizedToken: string): boolean {
	const aliases = COLOR_ALIASES[normalizedToken];
	return aliases?.some((alias) => normalizedText.includes(alias)) ?? false;
}

export interface NameCoverage {
	total: number;
	found: number;
	recall: number;
	missing: string[];
}

/** Share of the raw's technical tokens present in any of the given texts. */
export function coverageAgainst(raw: string, texts: string[]): NameCoverage {
	const tokens = extractSpecTokens(raw);
	const normalizedTexts = texts.map(normalizeForCompare).join(" ");
	const missing: string[] = [];
	let found = 0;

	for (const token of tokens) {
		const normalizedToken = normalizeForCompare(token.text);
		const present =
			containsFuzzy(normalizedTexts, normalizedToken) ||
			(token.kind === "tono" && hasColorAlias(normalizedTexts, normalizedToken));

		if (present) {
			found++;
		} else {
			missing.push(token.text);
		}
	}

	return {
		total: tokens.length,
		found,
		recall: tokens.length === 0 ? 1 : found / tokens.length,
		missing,
	};
}

/** Share of the raw's technical tokens that survived into the product name. */
export function nameCoverage(raw: string, name: string): NameCoverage {
	return coverageAgainst(raw, [name]);
}

/** Spec values carrying numbers that do not appear anywhere in the raw. */
export function hallucinatedSpecValues(
	raw: string,
	specifications: Array<{ key: string; value: string }>,
): string[] {
	const normalizedRaw = normalizeForCompare(raw);

	return specifications
		.filter((spec) => /\d/.test(spec.value))
		.filter((spec) => {
			const digits = spec.value.match(/\d+/g) ?? [];
			return digits.some((digit) => !normalizedRaw.includes(digit));
		})
		.map((spec) => `${spec.key}: ${spec.value}`);
}
