import type { ProductSpecification } from "@renovabit/db/schema";

/**
 * Deterministic SEO field generation for products.
 *
 * The meta fields are derived from data the catalog already holds (name, brand,
 * category, specifications) instead of being written by the model:
 *
 * - Consistency: every product gets the same structure, so the catalog reads as
 *   a system and not as 900 independent AI moods.
 * - Zero hallucination: a spec invented in a meta description ends up in front
 *   of Google, so the text is assembled only from stored, verified values.
 * - Zero cost: it can be regenerated for the whole catalog in seconds, with no
 *   AI calls, and re-run whenever the catalog data changes.
 *
 * The model still owns the commercial `description`; these fields are metadata.
 */

const SEO_TITLE_MAX = 255;
const SEO_DESCRIPTION_MAX = 500;
const SEO_KEYWORDS_MAX = 500;
const SITE_SUFFIX = " | Renovabit";
/** Google shows roughly this much of a meta description; longer gets cut. */
const META_DESCRIPTION_TARGET = 160;
/** Spec values longer than this are prose, not keywords. */
const KEYWORD_VALUE_MAX = 30;
const DESCRIPTION_SPEC_LIMIT = 6;

export interface ProductSeoInput {
	name: string;
	brandName: string | null | undefined;
	categoryName: string | null | undefined;
	specifications: ProductSpecification[] | null | undefined;
}

export interface ProductSeo {
	seoTitle: string;
	seoDescription: string;
	seoKeywords: string;
}

function buildSeoTitle(name: string): string {
	const trimmed = name.trim();
	const withSuffix = `${trimmed}${SITE_SUFFIX}`;
	if (withSuffix.length <= SEO_TITLE_MAX) return withSuffix;

	const room = SEO_TITLE_MAX - SITE_SUFFIX.length;
	return `${trimmed.slice(0, room).trimEnd()}${SITE_SUFFIX}`;
}

function buildSeoDescription(name: string, specifications: ProductSpecification[]): string {
	const head = `${name.trim()}.`;
	const fitted: string[] = [];

	for (const spec of specifications.slice(0, DESCRIPTION_SPEC_LIMIT)) {
		const candidate = [...fitted, `${spec.key}: ${spec.value}`].join(", ");
		if (`${head} ${candidate}.`.length > META_DESCRIPTION_TARGET) break;
		fitted.push(`${spec.key}: ${spec.value}`);
	}

	const body = fitted.length > 0 ? `${head} ${fitted.join(", ")}.` : head;
	return body.slice(0, SEO_DESCRIPTION_MAX);
}

function buildSeoKeywords(
	brandName: string | null | undefined,
	categoryName: string | null | undefined,
	specifications: ProductSpecification[],
): string {
	const terms = [
		brandName?.trim(),
		categoryName?.trim(),
		...specifications
			.map((spec) => spec.value.trim())
			.filter((value) => value.length > 1 && value.length <= KEYWORD_VALUE_MAX),
	].filter((term): term is string => Boolean(term));

	const seen = new Set<string>();
	let result = "";

	for (const term of terms) {
		const key = term.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);

		const next = result ? `${result}, ${term}` : term;
		if (next.length > SEO_KEYWORDS_MAX) break;
		result = next;
	}

	return result;
}

export function buildProductSeo(input: ProductSeoInput): ProductSeo {
	const specifications = input.specifications ?? [];

	return {
		seoTitle: buildSeoTitle(input.name),
		seoDescription: buildSeoDescription(input.name, specifications),
		seoKeywords: buildSeoKeywords(input.brandName, input.categoryName, specifications),
	};
}
