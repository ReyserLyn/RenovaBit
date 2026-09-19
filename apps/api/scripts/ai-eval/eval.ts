/**
 * Prompt/model evaluation over real supplier raws.
 *
 * Every run scores the same fixture (real production raws) with the same
 * metrics, so "better prompt" and "better model" become measurable instead of
 * anecdotal. The stored production output is scored too, for free, as the
 * baseline.
 *
 * Usage:
 *   cd apps/api && bun run scripts/ai-eval/eval.ts                       # full matrix
 *   cd apps/api && bun run scripts/ai-eval/eval.ts --prompts=v2 --models=deepseek
 */
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import pLimit from "p-limit";
import { buildExtractionPrompt } from "../../src/modules/product-processing/ai/prompts";
import { productExtractionSchema } from "../../src/modules/product-processing/ai/schemas";
import fixture from "./fixture.json";
import { coverageAgainst, hallucinatedSpecValues, nameCoverage } from "./metrics";
import { buildExtractionPromptV1 } from "./prompt-v1";

type FixtureItem = {
	raw: string;
	rawPrice: string;
	aiName: string;
	specs: Array<{ key: string; value: string }> | null;
	category: string;
};

type Category = { name: string; parent: string | null; leaf: boolean };

const { categories, brands, items } = fixture as {
	categories: Category[];
	brands: string[];
	items: FixtureItem[];
};

const MODELS: Record<string, { id: string; inPrice: number; outPrice: number }> = {
	deepseek: { id: "deepseek/deepseek-v4.1-flash", inPrice: 0.14, outPrice: 0.42 },
	openai: { id: "openai/gpt-4o-mini", inPrice: 0.15, outPrice: 0.6 },
};

const CONCURRENCY = 8;
const TIMEOUT_MS = 60_000;
const REPORT_PATH = new URL("./report.json", import.meta.url).pathname;

const args = Object.fromEntries(
	process.argv.slice(2).map((arg) => {
		const [key, value = ""] = arg.replace(/^--/, "").split("=");
		return [key, value];
	}),
);
const modelKeys = (args.models || "deepseek,openai").split(",");
const promptKeys = (args.prompts || "v1,v2").split(",");
const SELECTED_ITEMS = items.slice(0, Number(args.limit ?? items.length));

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

function buildModel(key: string) {
	const model = MODELS[key];
	if (!model) throw new Error(`Unknown model key: ${key}`);

	const settings = { usage: { include: true } } as const;
	if (key === "deepseek") {
		return openrouter.chat(model.id, {
			...settings,
			provider: { order: ["DeepInfra", "Morph", "DeepSeek"], allow_fallbacks: true },
			reasoning: { effort: "none" },
		});
	}
	return openrouter.chat(model.id, settings);
}

function buildPrompt(key: string, raw: string): string {
	if (key === "v2") {
		// v2 is the production prompt now: the eval measures what actually ships.
		return buildExtractionPrompt(raw, { categories, brands });
	}
	return buildExtractionPromptV1(raw, {
		categories: categories.filter((category) => category.leaf).map((c) => c.name),
		brands,
	});
}

interface ItemResult {
	raw: string;
	ok: boolean;
	error?: string;
	ms: number;
	name: string;
	brand: string;
	category: string;
	specCount: number;
	specValues: string[];
	needsReview: boolean;
	recall: number;
	total: number;
	missing: string[];
	hallucinations: string[];
	inputTokens: number;
	outputTokens: number;
}

async function runItem(
	modelKey: string,
	promptKey: string,
	item: FixtureItem,
): Promise<ItemResult> {
	const startedAt = Date.now();
	const base: ItemResult = {
		raw: item.raw,
		ok: false,
		ms: 0,
		name: "",
		brand: "",
		category: "",
		specCount: 0,
		specValues: [],
		needsReview: false,
		recall: 0,
		total: 0,
		missing: [],
		hallucinations: [],
		inputTokens: 0,
		outputTokens: 0,
	};

	try {
		const { output, usage } = await Promise.race([
			generateText({
				model: buildModel(modelKey),
				output: Output.object({ schema: productExtractionSchema }),
				prompt: buildPrompt(promptKey, item.raw),
				temperature: 0,
			}),
			new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
		]);

		const coverage = nameCoverage(item.raw, output.name);

		return {
			...base,
			ok: true,
			ms: Date.now() - startedAt,
			name: output.name,
			brand: output.brand,
			category: output.category,
			specCount: output.specifications.length,
			specValues: output.specifications.map((spec) => `${spec.key} ${spec.value}`),
			needsReview: output.needsReview,
			recall: coverage.recall,
			total: coverage.total,
			missing: coverage.missing,
			hallucinations: hallucinatedSpecValues(item.raw, output.specifications),
			inputTokens: usage.inputTokens ?? 0,
			outputTokens: usage.outputTokens ?? 0,
		};
	} catch (error) {
		return {
			...base,
			ms: Date.now() - startedAt,
			error: error instanceof Error ? error.message.slice(0, 120) : String(error),
		};
	}
}

interface RunSummary {
	model: string;
	prompt: string;
	items: number;
	failed: number;
	scoredItems: number;
	avgRecall: number;
	lostTokens: number;
	hallucinations: number;
	parentCategories: number;
	newCategories: number;
	newCategoryNames: string[];
	unknownBrands: number;
	needsReviewRate: number;
	avgSpecs: number;
	avgMs: number;
	costUsd: number;
	topMissing: Array<{ token: string; count: number }>;
	examples: Array<{ raw: string; name: string; missing: string[] }>;
}

function summarize(modelKey: string, promptKey: string, results: ItemResult[]): RunSummary {
	const ok = results.filter((result) => result.ok);
	const scored = ok.filter((result) => result.total > 0);
	const leafNames = new Set(categories.filter((c) => c.leaf).map((c) => c.name));
	const parentNames = new Set(categories.filter((c) => !c.leaf).map((c) => c.name));
	const bannedUmbrellas = new Set([
		"Accesorios",
		"Otros",
		"Varios",
		"Componentes",
		"Equipos",
		"Periféricos",
		"Perifericos",
	]);
	const canonicalBrands = new Set(brands.map((brand) => brand.toLowerCase()));
	const leafOf = (category: string) => category.split(">").pop()?.trim() ?? category;
	const isBannedCategory = (category: string) => {
		const leaf = leafOf(category);
		return parentNames.has(leaf) || bannedUmbrellas.has(leaf);
	};
	const isNewCategory = (category: string) => {
		const leaf = leafOf(category);
		return !leafNames.has(leaf) && !isBannedCategory(category);
	};

	const missingCounts = new Map<string, number>();
	for (const result of ok) {
		for (const token of result.missing) {
			missingCounts.set(token, (missingCounts.get(token) ?? 0) + 1);
		}
	}

	const model = MODELS[modelKey];
	const inputTokens = ok.reduce((sum, r) => sum + r.inputTokens, 0);
	const outputTokens = ok.reduce((sum, r) => sum + r.outputTokens, 0);

	return {
		model: modelKey,
		prompt: promptKey,
		items: results.length,
		failed: results.length - ok.length,
		scoredItems: scored.length,
		avgRecall:
			scored.length === 0 ? 0 : scored.reduce((sum, r) => sum + r.recall, 0) / scored.length,
		lostTokens: ok.reduce((sum, r) => sum + r.missing.length, 0),
		hallucinations: ok.reduce((sum, r) => sum + r.hallucinations.length, 0),
		parentCategories: ok.filter((r) => isBannedCategory(r.category)).length,
		newCategories: ok.filter((r) => isNewCategory(r.category)).length,
		newCategoryNames: [
			...new Set(ok.filter((r) => isNewCategory(r.category)).map((r) => leafOf(r.category))),
		].sort(),
		unknownBrands: ok.filter(
			(r) => r.brand.length > 0 && !canonicalBrands.has(r.brand.toLowerCase()),
		).length,
		needsReviewRate: ok.length === 0 ? 0 : ok.filter((r) => r.needsReview).length / ok.length,
		avgSpecs: ok.length === 0 ? 0 : ok.reduce((sum, r) => sum + r.specCount, 0) / ok.length,
		avgMs: ok.length === 0 ? 0 : ok.reduce((sum, r) => sum + r.ms, 0) / ok.length,
		costUsd:
			((inputTokens * (model?.inPrice ?? 0) + outputTokens * (model?.outPrice ?? 0)) / 1_000_000) *
			1,
		topMissing: [...missingCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8)
			.map(([token, count]) => ({ token, count })),
		examples: ok
			.filter((r) => r.missing.length > 0)
			.slice(0, 3)
			.map((r) => ({ raw: r.raw, name: r.name, missing: r.missing })),
	};
}

const BASELINE_LABEL = "gpt-4o-mini (producción)";

function baselineResults(selectedItems: FixtureItem[]): ItemResult[] {
	return selectedItems.map((item) => {
		const specValues = (item.specs ?? []).map((spec) => `${spec.key} ${spec.value}`);
		const coverage = coverageAgainst(item.raw, [item.aiName, ...specValues]);
		return {
			raw: item.raw,
			ok: true,
			ms: 0,
			name: item.aiName,
			brand: "",
			category: item.category,
			specCount: item.specs?.length ?? 0,
			specValues,
			needsReview: false,
			recall: coverage.recall,
			total: coverage.total,
			missing: coverage.missing,
			hallucinations: hallucinatedSpecValues(item.raw, item.specs ?? []),
			inputTokens: 0,
			outputTokens: 0,
		};
	});
}

function formatRow(summary: RunSummary): string {
	const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
	return `| ${summary.model} | ${summary.prompt} | ${pct(summary.avgRecall)} | ${summary.lostTokens} | ${summary.hallucinations} | ${summary.parentCategories} | ${summary.newCategories} | ${summary.unknownBrands} | ${pct(summary.needsReviewRate)} | ${summary.avgSpecs.toFixed(1)} | ${(summary.avgMs / 1000).toFixed(1)}s | $${summary.costUsd.toFixed(3)} | ${summary.failed} |`;
}

const limit = pLimit(CONCURRENCY);
const reports: RunSummary[] = [];
const runs: Array<{ model: string; prompt: string; items: ItemResult[] }> = [];

function printReport(summaries: RunSummary[]): void {
	console.log("\n## Tabla comparativa\n");
	console.log(
		"| modelo | prompt | recall specs | tokens perdidos | alucinaciones | cats. padre | cats. nuevas | marcas desconocidas | needsReview | specs avg | latencia | costo | fallos |",
	);
	console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
	for (const report of summaries) console.log(formatRow(report));

	for (const report of summaries) {
		console.log(`\n### ${report.model} + ${report.prompt}`);
		if (report.newCategoryNames.length > 0) {
			console.log(`categorías nuevas propuestas: ${report.newCategoryNames.join(", ")}`);
		}
		if (report.topMissing.length > 0) {
			console.log(
				`tokens más perdidos: ${report.topMissing.map((t) => `${t.token} (${t.count})`).join(", ")}`,
			);
		}
		for (const example of report.examples) {
			console.log(`- raw: ${example.raw}`);
			console.log(`  → ${example.name}`);
			console.log(`  perdidos: ${example.missing.join(", ")}`);
		}
	}
}

/** Re-scores a stored report with the current metrics, with no API calls. */
async function rescore(): Promise<never> {
	const stored = (await Bun.file(REPORT_PATH).json()) as {
		runs: Array<{ model: string; prompt: string; items: ItemResult[] }>;
	};

	const summaries = stored.runs.map((run) => {
		const results = run.items.map((item) => {
			const coverage = coverageAgainst(item.raw, [item.name, ...(item.specValues ?? [])]);
			return {
				...item,
				recall: coverage.recall,
				total: coverage.total,
				missing: coverage.missing,
			};
		});
		return summarize(run.model, run.prompt, results);
	});

	printReport(summaries);
	process.exit(0);
}

// --rescore re-scores the last report in place: iterate on metrics, not on API spend.
if (args.rescore !== undefined) {
	await rescore();
}

console.log(
	`Eval: ${SELECTED_ITEMS.length} raws reales | modelos: ${modelKeys.join(", ")} | prompts: ${promptKeys.join(", ")}\n`,
);

const baselineItems = baselineResults(SELECTED_ITEMS);
const baseline = {
	...summarize("baseline", "v1", baselineItems),
	model: BASELINE_LABEL,
	costUsd: 0,
};
reports.push(baseline);
runs.push({ model: BASELINE_LABEL, prompt: "v1", items: baselineItems });
console.log(
	`[baseline] ${BASELINE_LABEL} + v1 → recall ${(baseline.avgRecall * 100).toFixed(1)}% | ${baseline.lostTokens} tokens perdidos`,
);

for (const modelKey of modelKeys) {
	for (const promptKey of promptKeys) {
		const startedAt = Date.now();
		const results = await Promise.all(
			SELECTED_ITEMS.map((item) => limit(() => runItem(modelKey, promptKey, item))),
		);
		const summary = summarize(modelKey, promptKey, results);
		reports.push(summary);
		runs.push({ model: modelKey, prompt: promptKey, items: results });

		console.log(
			`[${modelKey} + ${promptKey}] recall ${(summary.avgRecall * 100).toFixed(1)}% | perdidos ${summary.lostTokens} | alucinaciones ${summary.hallucinations} | padres ${summary.parentCategories} | ${(summary.avgMs / 1000).toFixed(1)}s | $${summary.costUsd.toFixed(3)} | fallos ${summary.failed} (${((Date.now() - startedAt) / 1000).toFixed(0)}s)`,
		);
	}
}

printReport(reports);

await Bun.write(
	REPORT_PATH,
	JSON.stringify({ generatedAt: new Date().toISOString(), reports, runs }, null, 2),
);
console.log(`\nJSON completo: ${REPORT_PATH}`);
